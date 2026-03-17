const nodemailer = require('nodemailer');

const TAG = 'EmailService';
const FALLBACK_FROM = 'no-reply@lgym.local';
const DEFAULT_VERIFICATION_SUBJECT = 'Codigo de verificacion - LGYM';
const DEFAULT_CODE_TTL_MINUTES = 15;
const VERIFICATION_CODE_DIGITS = 6;
const MAX_CODE_GENERATION_ATTEMPTS = 5;
const DEFAULT_SMTP_CONNECTION_TIMEOUT_MS = 10000;
const DEFAULT_SMTP_GREETING_TIMEOUT_MS = 10000;
const DEFAULT_SMTP_SOCKET_TIMEOUT_MS = 20000;
const DEFAULT_RESEND_API_URL = 'https://api.resend.com/emails';
const DEFAULT_GMAIL_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_GMAIL_API_BASE_URL = 'https://gmail.googleapis.com/gmail/v1/users';
const DEFAULT_GMAIL_API_USER = 'me';
const GMAIL_TOKEN_EXPIRY_SKEW_MS = 60 * 1000;

const parsePositiveInt = (value, fallback) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return fallback;
};

const CODE_TTL_MS =
  parsePositiveInt(process.env.EMAIL_CODE_TTL_MINUTES, DEFAULT_CODE_TTL_MINUTES) * 60 * 1000;

const accountVerificationCodes = new Map();
const resetPasswordCodes = new Map();

let cachedTransporter = null;
let warnedMissingEmailConfig = false;
let cachedGmailAccessToken = '';
let cachedGmailAccessTokenExpiresAt = 0;

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
const getEmailService = () => safeText(process.env.EMAIL_SERVICE).trim();
const getEmailTransport = () =>
  safeText(process.env.EMAIL_TRANSPORT)
    .trim()
    .toLowerCase()
    .replace(/-/g, '_');
const getSmtpHost = () => safeText(process.env.EMAIL_SMTP_HOST).trim();
const getSmtpPort = () => parsePositiveInt(process.env.EMAIL_SMTP_PORT, 0);
const getSmtpSecure = () => parseBoolean(process.env.EMAIL_SMTP_SECURE, getSmtpPort() === 465);
const getSmtpRequireTls = () => parseBoolean(process.env.EMAIL_SMTP_REQUIRE_TLS, false);
const getSmtpIgnoreTls = () => parseBoolean(process.env.EMAIL_SMTP_IGNORE_TLS, false);
const getResendApiKey = () => safeText(process.env.RESEND_API_KEY).trim();
const getResendApiUrl = () => safeText(process.env.RESEND_API_URL).trim() || DEFAULT_RESEND_API_URL;
const getGmailApiClientId = () => safeText(process.env.GMAIL_API_CLIENT_ID).trim();
const getGmailApiClientSecret = () => safeText(process.env.GMAIL_API_CLIENT_SECRET).trim();
const getGmailApiRefreshToken = () => safeText(process.env.GMAIL_API_REFRESH_TOKEN).trim();
const getGmailApiUser = () =>
  safeText(process.env.GMAIL_API_USER).trim() || DEFAULT_GMAIL_API_USER;
const getGmailApiTokenUrl = () =>
  safeText(process.env.GMAIL_API_TOKEN_URL).trim() || DEFAULT_GMAIL_TOKEN_URL;
const getGmailApiBaseUrl = () =>
  safeText(process.env.GMAIL_API_BASE_URL).trim() || DEFAULT_GMAIL_API_BASE_URL;
const getConfiguredFromAddress = () =>
  safeText(process.env.EMAIL_FROM).trim() || getEmailUser() || '';
const getFromAddress = () => getConfiguredFromAddress() || FALLBACK_FROM;

const normalizeEmailList = (value) => {
  if (Array.isArray(value)) {
    return value.map(normalizeEmailKey).filter(Boolean);
  }

  const raw = safeText(value).trim();
  if (!raw) return [];

  return raw
    .split(',')
    .map((entry) => normalizeEmailKey(entry))
    .filter(Boolean);
};

const toSingleOrArray = (values) => {
  if (!Array.isArray(values) || values.length === 0) return undefined;
  return values.length === 1 ? values[0] : values;
};

const parseJsonSafely = (value) => {
  if (!value) return null;

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
};

const hasSmtpConfig = () => {
  const user = getEmailUser();
  const pass = getEmailPass();
  return Boolean(getSmtpHost() || (user && pass));
};

const hasGmailApiConfig = () =>
  Boolean(getGmailApiClientId() && getGmailApiClientSecret() && getGmailApiRefreshToken());

const resolveEmailTransport = () => {
  const preferredTransport = getEmailTransport();
  const hasGmailApi = hasGmailApiConfig();
  const hasResend = Boolean(getResendApiKey());
  const hasSmtp = hasSmtpConfig();

  if (preferredTransport === 'gmail_api') {
    return hasGmailApi ? 'gmail_api' : null;
  }

  if (preferredTransport === 'resend') {
    return hasResend ? 'resend' : null;
  }

  if (preferredTransport === 'smtp') {
    return hasSmtp ? 'smtp' : null;
  }

  if (hasGmailApi) return 'gmail_api';
  if (hasResend) return 'resend';
  if (hasSmtp) return 'smtp';
  return null;
};

const getMissingEmailConfigMessage = () =>
  [
    'No hay proveedor de correo configurado.',
    'Usa GMAIL_API_CLIENT_ID + GMAIL_API_CLIENT_SECRET + GMAIL_API_REFRESH_TOKEN para Gmail API por HTTPS,',
    'o RESEND_API_KEY (+ EMAIL_FROM),',
    'o configura EMAIL_USER/EMAIL_PASS y opcionalmente EMAIL_SERVICE o EMAIL_SMTP_HOST para SMTP.'
  ].join(' ');

const buildSmtpTransportOptions = () => {
  const user = getEmailUser();
  const pass = getEmailPass();
  const host = getSmtpHost();
  const port = getSmtpPort();
  const service = getEmailService() || (!host ? 'gmail' : '');

  return {
    ...(service ? { service } : {}),
    ...(host ? { host } : {}),
    ...(port ? { port } : {}),
    secure: getSmtpSecure(),
    requireTLS: getSmtpRequireTls(),
    ignoreTLS: getSmtpIgnoreTls(),
    connectionTimeout: parsePositiveInt(
      process.env.EMAIL_SMTP_CONNECTION_TIMEOUT_MS,
      DEFAULT_SMTP_CONNECTION_TIMEOUT_MS
    ),
    greetingTimeout: parsePositiveInt(
      process.env.EMAIL_SMTP_GREETING_TIMEOUT_MS,
      DEFAULT_SMTP_GREETING_TIMEOUT_MS
    ),
    socketTimeout: parsePositiveInt(
      process.env.EMAIL_SMTP_SOCKET_TIMEOUT_MS,
      DEFAULT_SMTP_SOCKET_TIMEOUT_MS
    ),
    ...(user && pass ? { auth: { user, pass } } : {})
  };
};

const getTransporter = () => {
  if (cachedTransporter) {
    return cachedTransporter;
  }

  if (resolveEmailTransport() !== 'smtp') {
    if (!warnedMissingEmailConfig) {
      warnedMissingEmailConfig = true;
      console.warn(`[${TAG}] ${getMissingEmailConfigMessage()}`);
    }
    return null;
  }

  cachedTransporter = nodemailer.createTransport(buildSmtpTransportOptions());

  return cachedTransporter;
};

const buildTimeoutHint = (error) => {
  if (error?.code !== 'ETIMEDOUT') return '';

  return [
    'La conexion SMTP expiro antes de completarse.',
    'Si el backend corre en Render Free, ese plan bloquea trafico saliente por los puertos 25, 465 y 587.',
    'En ese caso usa Gmail API por HTTPS o RESEND_API_KEY + EMAIL_FROM, o cambia el servicio a un plan pago.'
  ].join(' ');
};

const decodeBasicHtmlEntities = (value) =>
  safeText(value)
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");

const htmlToText = (value) =>
  decodeBasicHtmlEntities(
    safeText(value)
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<\/h[1-6]>/gi, '\n\n')
      .replace(/<li>/gi, '- ')
      .replace(/<\/li>/gi, '\n')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();

const encodeBase64Url = (value) =>
  Buffer.from(safeText(value), 'utf8')
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');

const buildMimeMessage = (mailOptions) => {
  const to = normalizeEmailList(mailOptions?.to);
  const cc = normalizeEmailList(mailOptions?.cc);
  const bcc = normalizeEmailList(mailOptions?.bcc);
  const replyTo = normalizeEmailList(mailOptions?.replyTo);
  const from = sanitizeHeaderValue(mailOptions?.from || getConfiguredFromAddress());
  const subject = sanitizeHeaderValue(mailOptions?.subject);
  const textBody = safeText(mailOptions?.text).trim() || htmlToText(mailOptions?.html);
  const htmlBody = safeText(mailOptions?.html).trim();
  const boundary = `lgym_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const headers = [
    ...(from ? [`From: ${from}`] : []),
    ...(to.length ? [`To: ${to.join(', ')}`] : []),
    ...(cc.length ? [`Cc: ${cc.join(', ')}`] : []),
    ...(bcc.length ? [`Bcc: ${bcc.join(', ')}`] : []),
    ...(replyTo.length ? [`Reply-To: ${replyTo.join(', ')}`] : []),
    ...(subject ? [`Subject: ${subject}`] : []),
    'MIME-Version: 1.0'
  ];

  if (htmlBody && textBody) {
    return [
      ...headers,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      textBody,
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      'Content-Transfer-Encoding: 7bit',
      '',
      htmlBody,
      `--${boundary}--`,
      ''
    ].join('\r\n');
  }

  return [
    ...headers,
    `Content-Type: ${htmlBody ? 'text/html' : 'text/plain'}; charset="UTF-8"`,
    'Content-Transfer-Encoding: 7bit',
    '',
    htmlBody || textBody
  ].join('\r\n');
};

const buildGmailApiHint = (status, payload, stage) => {
  const errorMessage =
    payload?.error?.message || payload?.error_description || payload?.message || payload?.error;

  if (stage === 'token' && safeText(payload?.error).trim() === 'invalid_grant') {
    return [
      'Google rechazo el refresh token.',
      'Verifica que GMAIL_API_CLIENT_ID, GMAIL_API_CLIENT_SECRET y GMAIL_API_REFRESH_TOKEN pertenezcan al mismo proyecto OAuth.'
    ].join(' ');
  }

  if (status === 403) {
    return [
      'Google devolvio 403 al intentar enviar por Gmail API.',
      'Confirma que el proyecto tenga habilitada la Gmail API y que el refresh token tenga el scope https://www.googleapis.com/auth/gmail.send.'
    ].join(' ');
  }

  if (status === 400 && errorMessage) {
    return `Google devolvio 400: ${errorMessage}`;
  }

  return '';
};

const getGmailAccessToken = async () => {
  if (
    cachedGmailAccessToken &&
    Date.now() + GMAIL_TOKEN_EXPIRY_SKEW_MS < cachedGmailAccessTokenExpiresAt
  ) {
    return cachedGmailAccessToken;
  }

  if (typeof fetch !== 'function') {
    console.error(
      `[${TAG}] fetch no esta disponible en este runtime. No se puede usar Gmail API sin soporte HTTP nativo.`
    );
    return '';
  }

  try {
    const response = await fetch(getGmailApiTokenUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: getGmailApiClientId(),
        client_secret: getGmailApiClientSecret(),
        refresh_token: getGmailApiRefreshToken(),
        grant_type: 'refresh_token'
      }).toString()
    });

    const rawBody = await response.text();
    const parsedBody = parseJsonSafely(rawBody);

    if (!response.ok || !parsedBody?.access_token) {
      console.error(
        `[${TAG}] Error obteniendo access token de Gmail API:`,
        response.status,
        parsedBody || rawBody
      );
      const hint = buildGmailApiHint(response.status, parsedBody, 'token');
      if (hint) {
        console.error(`[${TAG}] ${hint}`);
      }
      return '';
    }

    cachedGmailAccessToken = safeText(parsedBody.access_token).trim();
    cachedGmailAccessTokenExpiresAt =
      Date.now() + parsePositiveInt(parsedBody.expires_in, 3600) * 1000;

    return cachedGmailAccessToken;
  } catch (error) {
    console.error(`[${TAG}] Error obteniendo access token de Gmail API:`, error);
    return '';
  }
};

const sendWithSmtp = async (mailOptions, contextLabel) => {
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
    const timeoutHint = buildTimeoutHint(error);
    if (timeoutHint) {
      console.error(`[${TAG}] ${timeoutHint}`);
    }
    return false;
  }
};

const sendWithResend = async (mailOptions, contextLabel) => {
  const apiKey = getResendApiKey();
  if (!apiKey) {
    return false;
  }

  if (typeof fetch !== 'function') {
    console.error(
      `[${TAG}] fetch no esta disponible en este runtime. No se puede usar Resend sin soporte HTTP nativo.`
    );
    return false;
  }

  const to = normalizeEmailList(mailOptions?.to);
  const cc = normalizeEmailList(mailOptions?.cc);
  const bcc = normalizeEmailList(mailOptions?.bcc);
  const replyTo = normalizeEmailList(mailOptions?.replyTo);
  if (to.length === 0) {
    console.error(`[${TAG}] No hay destinatarios validos (${contextLabel}).`);
    return false;
  }

  const payload = {
    from: sanitizeHeaderValue(mailOptions?.from || getFromAddress()) || FALLBACK_FROM,
    to: toSingleOrArray(to),
    subject: sanitizeHeaderValue(mailOptions?.subject),
    html: safeText(mailOptions?.html),
    ...(mailOptions?.text !== undefined ? { text: safeText(mailOptions.text) } : {}),
    ...(cc.length ? { cc: toSingleOrArray(cc) } : {}),
    ...(bcc.length ? { bcc: toSingleOrArray(bcc) } : {}),
    ...(replyTo.length ? { reply_to: toSingleOrArray(replyTo) } : {})
  };

  try {
    const response = await fetch(getResendApiUrl(), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const rawBody = await response.text();
    const parsedBody = parseJsonSafely(rawBody);

    if (!response.ok) {
      console.error(
        `[${TAG}] Error enviando correo (${contextLabel}) con Resend:`,
        response.status,
        parsedBody || rawBody
      );
      return false;
    }

    if (!parsedBody?.id) {
      console.warn(`[${TAG}] Resend respondio sin id de confirmacion (${contextLabel}).`, parsedBody);
    }

    return true;
  } catch (error) {
    console.error(`[${TAG}] Error enviando correo (${contextLabel}) con Resend:`, error);
    return false;
  }
};

const sendWithGmailApi = async (mailOptions, contextLabel) => {
  const to = normalizeEmailList(mailOptions?.to);
  if (to.length === 0) {
    console.error(`[${TAG}] No hay destinatarios validos (${contextLabel}).`);
    return false;
  }

  const accessToken = await getGmailAccessToken();
  if (!accessToken) {
    return false;
  }

  try {
    const response = await fetch(
      `${getGmailApiBaseUrl()}/${encodeURIComponent(getGmailApiUser())}/messages/send`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: encodeBase64Url(buildMimeMessage(mailOptions)) })
      }
    );

    const rawBody = await response.text();
    const parsedBody = parseJsonSafely(rawBody);

    if (!response.ok) {
      console.error(
        `[${TAG}] Error enviando correo (${contextLabel}) con Gmail API:`,
        response.status,
        parsedBody || rawBody
      );
      const hint = buildGmailApiHint(response.status, parsedBody, 'send');
      if (hint) {
        console.error(`[${TAG}] ${hint}`);
      }
      return false;
    }

    if (!parsedBody?.id) {
      console.warn(
        `[${TAG}] Gmail API respondio sin id de confirmacion (${contextLabel}).`,
        parsedBody
      );
    }

    return true;
  } catch (error) {
    console.error(`[${TAG}] Error enviando correo (${contextLabel}) con Gmail API:`, error);
    return false;
  }
};

const sendMailSafe = async (mailOptions, contextLabel) => {
  const transport = resolveEmailTransport();
  if (!transport) {
    if (!warnedMissingEmailConfig) {
      warnedMissingEmailConfig = true;
      console.warn(`[${TAG}] ${getMissingEmailConfigMessage()}`);
    }
    return false;
  }

  if (transport === 'gmail_api') {
    return sendWithGmailApi(mailOptions, contextLabel);
  }

  if (transport === 'resend') {
    return sendWithResend(mailOptions, contextLabel);
  }

  return sendWithSmtp(mailOptions, contextLabel);
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
