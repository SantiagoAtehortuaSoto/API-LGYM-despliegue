const nodemailer = require('nodemailer');

const TAG = 'EmailService';
const FALLBACK_FROM = 'no-reply@lgym.local';
const DEFAULT_VERIFICATION_SUBJECT = 'Codigo de verificacion - LGYM';
const DEFAULT_CODE_TTL_MINUTES = 15;
const VERIFICATION_CODE_DIGITS = 6;
const MAX_CODE_GENERATION_ATTEMPTS = 5;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const CODE_TTL_MS =
  parsePositiveInt(process.env.EMAIL_CODE_TTL_MINUTES, DEFAULT_CODE_TTL_MINUTES) * 60 * 1000;

const accountVerificationCodes = new Map();
const resetPasswordCodes = new Map();

let cachedTransporter = null;
let warnedMissingEmailConfig = false;

const normalizeEmailKey = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const safeText = (value) => (value === undefined || value === null ? '' : String(value));

const sanitizeHeaderValue = (value) =>
  safeText(value)
    .replace(/[\r\n]+/g, ' ')
    .trim();

const escapeHtml = (value) =>
  safeText(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const getEmailUser = () => safeText(process.env.EMAIL_USER).trim();
const getEmailPass = () => safeText(process.env.EMAIL_PASS).trim();
const getFromAddress = () => getEmailUser() || FALLBACK_FROM;

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  const user = getEmailUser();
  const pass = getEmailPass();

  if (!user || !pass) {
    if (!warnedMissingEmailConfig) {
      warnedMissingEmailConfig = true;
      console.warn(
        `[${TAG}] EMAIL_USER o EMAIL_PASS no configurados. Se omiten envios de correo.`
      );
    }
    return null;
  }

  cachedTransporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user, pass }
  });

  return cachedTransporter;
};

const sendMailSafe = async (mailOptions, contextLabel) => {
  const transporter = getTransporter();
  if (!transporter) {
    return false;
  }

  try {
    const info = await transporter.sendMail(mailOptions);
    const acceptedCount = Array.isArray(info?.accepted) ? info.accepted.length : 0;
    if (acceptedCount <= 0) {
      console.error(`[${TAG}] Correo no aceptado (${contextLabel}).`, info);
      return false;
    }
    return true;
  } catch (error) {
    console.error(`[${TAG}] Error enviando correo (${contextLabel}):`, error);
    return false;
  }
};

function generateVerificationCode() {
  const min = 10 ** (VERIFICATION_CODE_DIGITS - 1);
  const max = 10 ** VERIFICATION_CODE_DIGITS;
  return String(Math.floor(min + Math.random() * (max - min)));
}

const pruneExpiredCodes = (store) => {
  const now = Date.now();
  for (const [emailKey, data] of store.entries()) {
    if (!data || now > Number(data.expiresAt)) {
      store.delete(emailKey);
    }
  }
};

const saveCode = (store, email, code) => {
  const emailKey = normalizeEmailKey(email);
  if (!emailKey) return false;

  pruneExpiredCodes(store);
  store.set(emailKey, { code: safeText(code).trim(), expiresAt: Date.now() + CODE_TTL_MS });
  return true;
};

const verifyStoredCode = (store, email, code) => {
  const emailKey = normalizeEmailKey(email);
  if (!emailKey) return false;

  const stored = store.get(emailKey);
  if (!stored) return false;

  if (Date.now() > Number(stored.expiresAt)) {
    store.delete(emailKey);
    return false;
  }

  const isValid = safeText(stored.code).trim() === safeText(code).trim();
  if (!isValid) return false;

  store.delete(emailKey);
  return true;
};

const generateNonOverlappingCode = (email, otherStore) => {
  const emailKey = normalizeEmailKey(email);
  const other = emailKey ? otherStore.get(emailKey) : null;

  for (let attempt = 0; attempt < MAX_CODE_GENERATION_ATTEMPTS; attempt += 1) {
    const code = generateVerificationCode();
    if (!other || safeText(other.code).trim() !== code) {
      return code;
    }
  }

  return generateVerificationCode();
};

async function sendVerificationEmail(email, code, subject = DEFAULT_VERIFICATION_SUBJECT) {
  const to = normalizeEmailKey(email);
  if (!to) return false;

  const safeCode = escapeHtml(safeText(code).trim());
  const safeSubject = sanitizeHeaderValue(subject) || DEFAULT_VERIFICATION_SUBJECT;

  return sendMailSafe(
    {
      from: getFromAddress(),
      to,
      subject: safeSubject,
      html: `
        <h1>Codigo de verificacion</h1>
        <p>Tu codigo de verificacion es:</p>
        <h2 style="color:#007bff;font-size:24px;">${safeCode}</h2>
        <p>Este codigo expirara en ${Math.floor(CODE_TTL_MS / 60000)} minutos.</p>
        <p>Si no solicitaste este codigo, puedes ignorar este correo.</p>
      `
    },
    'verification'
  );
}

function createAccountVerificationCode(email) {
  const code = generateNonOverlappingCode(email, resetPasswordCodes);
  saveCode(accountVerificationCodes, email, code);
  return code;
}

function verifyAccountCode(email, code) {
  return verifyStoredCode(accountVerificationCodes, email, code);
}

function createResetPasswordCode(email) {
  const code = generateNonOverlappingCode(email, accountVerificationCodes);
  saveCode(resetPasswordCodes, email, code);
  return code;
}

function verifyResetPasswordCode(email, code) {
  return verifyStoredCode(resetPasswordCodes, email, code);
}

async function sendContactEmail(nombre, email, telefono, mensaje, emailEmpresa) {
  const companyEmail = normalizeEmailKey(emailEmpresa) || normalizeEmailKey(getEmailUser());
  const requesterEmail = normalizeEmailKey(email);
  if (!companyEmail) {
    console.error(`[${TAG}] No hay correo de empresa configurado para formulario de contacto.`);
    return false;
  }

  const safeNombre = escapeHtml(nombre || 'Cliente');
  const safeEmail = escapeHtml(email || 'N/D');
  const safeTelefono = escapeHtml(telefono || 'N/D');
  const safeMensaje = escapeHtml(mensaje || '').replace(/\n/g, '<br/>');
  const safeSubject = sanitizeHeaderValue(`Nuevo mensaje de contacto - ${nombre || 'Cliente'}`);

  return sendMailSafe(
    {
      from: getFromAddress(),
      to: companyEmail,
      ...(requesterEmail ? { cc: requesterEmail, replyTo: requesterEmail } : {}),
      subject: safeSubject,
      html: `
        <h1>Nuevo mensaje de contacto</h1>
        <p><strong>Nombre:</strong> ${safeNombre}</p>
        <p><strong>Email:</strong> ${safeEmail}</p>
        <p><strong>Telefono:</strong> ${safeTelefono}</p>
        <p><strong>Mensaje:</strong></p>
        <p>${safeMensaje}</p>
      `
    },
    'contact'
  );
}

const resolveDetalles = (compra, detalles) =>
  Array.isArray(detalles) && detalles.length
    ? detalles
    : Array.isArray(compra?.detalles_pedidos)
    ? compra.detalles_pedidos
    : Array.isArray(compra?.detallesPedidos)
    ? compra.detallesPedidos
    : Array.isArray(compra?.detalles)
    ? compra.detalles
    : [];

const buildPedidoRowsHtml = (detallesResolved = []) =>
  detallesResolved
    .map((detalle, index) => {
      const producto =
        detalle?.id_productos_producto?.nombre_producto ||
        detalle?.producto?.nombre_producto ||
        detalle?.producto?.nombre ||
        detalle?.producto?.nombreProducto ||
        detalle?.id_productos ||
        detalle?.id_producto ||
        'Producto';
      const cantidad = escapeHtml(detalle?.cantidad);

      return `
        <tr>
          <td style="padding:6px;border:1px solid #ddd;">${index + 1}</td>
          <td style="padding:6px;border:1px solid #ddd;">${escapeHtml(producto)}</td>
          <td style="padding:6px;border:1px solid #ddd;text-align:right;">${cantidad}</td>
        </tr>
      `;
    })
    .join('');

const buildPedidoDetalleTableHtml = (rowsHtml) => `
  <table style="border-collapse:collapse;width:100%;margin-top:12px;">
    <thead>
      <tr>
        <th style="padding:6px;border:1px solid #ddd;text-align:left;">#</th>
        <th style="padding:6px;border:1px solid #ddd;text-align:left;">Producto</th>
        <th style="padding:6px;border:1px solid #ddd;text-align:right;">Cantidad</th>
      </tr>
    </thead>
    <tbody>
      ${rowsHtml || '<tr><td colspan="3" style="padding:6px;border:1px solid #ddd;">Sin detalles</td></tr>'}
    </tbody>
  </table>
`;

async function sendProveedorPedidoEmailBase({
  to,
  cc,
  proveedor,
  compra,
  detalles,
  subjectPrefix,
  title,
  intro
}) {
  const toEmail = normalizeEmailKey(to);
  if (!toEmail) return false;

  const ccEmail = normalizeEmailKey(cc);
  const proveedorNombre = escapeHtml(
    proveedor?.nombre_proveedor || proveedor?.nombre_contacto || 'Proveedor'
  );
  const numeroPedido = sanitizeHeaderValue(compra?.numero_pedido || compra?.id_pedido || 'N/D');
  const fechaPedido = escapeHtml(compra?.fecha_pedido || 'N/D');
  const detallesResolved = resolveDetalles(compra, detalles);
  const rowsHtml = buildPedidoRowsHtml(detallesResolved);
  const tableHtml = buildPedidoDetalleTableHtml(rowsHtml);

  return sendMailSafe(
    {
      from: getFromAddress(),
      to: toEmail,
      ...(ccEmail ? { cc: ccEmail, replyTo: ccEmail } : {}),
      subject: `${subjectPrefix} #${numeroPedido || 'N/D'}`,
      html: `
        <h2>${escapeHtml(title)}</h2>
        <p>Hola ${proveedorNombre},</p>
        <p>${escapeHtml(intro)}</p>
        <ul>
          <li><strong>Numero de pedido:</strong> ${escapeHtml(numeroPedido || 'N/D')}</li>
          <li><strong>Fecha de pedido:</strong> ${fechaPedido}</li>
        </ul>
        ${tableHtml}
        <p>Gracias por confirmar este pedido.</p>
      `
    },
    'proveedor-pedido'
  );
}

async function sendProveedorPedidoEmail({ to, cc, proveedor, compra, detalles }) {
  return sendProveedorPedidoEmailBase({
    to,
    cc,
    proveedor,
    compra,
    detalles,
    subjectPrefix: 'Pedido a proveedor',
    title: 'Nuevo pedido a proveedor',
    intro: 'Se ha generado un pedido con la siguiente informacion:'
  });
}

async function sendProveedorPedidoActualizadoEmail({ to, cc, proveedor, compra, detalles }) {
  return sendProveedorPedidoEmailBase({
    to,
    cc,
    proveedor,
    compra,
    detalles,
    subjectPrefix: 'Pedido modificado pendiente de aprobacion',
    title: 'Pedido modificado antes de aprobacion',
    intro: 'Este pedido fue modificado antes de su aprobacion. Revisa la version actualizada:'
  });
}

module.exports = {
  generateVerificationCode,
  sendVerificationEmail,
  createAccountVerificationCode,
  verifyAccountCode,
  createResetPasswordCode,
  verifyResetPasswordCode,
  sendContactEmail,
  sendProveedorPedidoEmail,
  sendProveedorPedidoActualizadoEmail
};
