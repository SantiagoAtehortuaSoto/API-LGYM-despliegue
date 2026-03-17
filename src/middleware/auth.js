const jwt = require('jsonwebtoken');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || null;
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID || 1);
const ADMIN_ROLE_NAME = (process.env.ADMIN_ROLE_NAME || 'Administrador')
  .trim()
  .toLowerCase();
const AUTH_DEBUG = process.env.AUTH_DEBUG === 'true';
const TAG = 'AUTH';
const AUTH_TOKEN_COOKIE_KEYS = ['token', 'access_token', 'auth_token', 'jwt', 'authorization'];

const debugLog = (...args) => {
  if (AUTH_DEBUG) {
    console.log(`[${TAG}]`, ...args);
  }
};

const decodeToken = (token) => jwt.verify(token, SECRET_KEY);
const signUserToken = (payload) =>
  TOKEN_EXPIRES_IN
    ? jwt.sign(payload, SECRET_KEY, { expiresIn: TOKEN_EXPIRES_IN })
    : jwt.sign(payload, SECRET_KEY);

const maskToken = (token) => {
  if (!token || typeof token !== 'string') return String(token);
  const trimmed = token.trim();
  if (trimmed.length <= 12) return `${trimmed.slice(0, 4)}...${trimmed.slice(-2)}`;
  return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
};

const normalizeToken = (rawToken) => {
  if (!rawToken || typeof rawToken !== 'string') return rawToken;

  let token = rawToken.trim();
  while (token.toLowerCase().startsWith('bearer ')) {
    token = token.slice(7).trim();
  }

  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    token = token.slice(1, -1).trim();
  }

  return token;
};

const extractUserId = (decoded) => {
  const candidates = [
    decoded?.id,
    decoded?.id_usuario,
    decoded?.idUsuario,
    decoded?.userId,
    decoded?.user_id,
    decoded?.sub,
    decoded?.user?.id,
    decoded?.user?.id_usuario,
    decoded?.usuario?.id,
    decoded?.usuario?.id_usuario
  ];

  for (const candidate of candidates) {
    const parsed = Number(candidate);
    if (Number.isInteger(parsed) && parsed > 0) {
      return parsed;
    }
  }

  return null;
};

const parseCookieHeader = (rawCookieHeader) => {
  if (!rawCookieHeader || typeof rawCookieHeader !== 'string') {
    return {};
  }

  return rawCookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((acc, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex <= 0) return acc;
      const key = part.slice(0, separatorIndex).trim();
      const value = part.slice(separatorIndex + 1).trim();
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});
};

const getCookieTokenEntry = (req) => {
  const cookies = parseCookieHeader(req.headers?.cookie);
  for (const key of AUTH_TOKEN_COOKIE_KEYS) {
    const value = cookies[key];
    if (value) {
      return { source: `cookie:${key}`, value };
    }
  }
  return null;
};

const getAuthHeader = (req) => {
  const candidates = [
    { source: 'header:authorization', value: req.headers?.authorization },
    { source: 'header:x-access-token', value: req.headers?.['x-access-token'] },
    { source: 'header:x-token', value: req.headers?.['x-token'] },
    { source: 'header:token', value: req.headers?.token },
    { source: 'header:auth-token', value: req.headers?.['auth-token'] },
    { source: 'header:x-auth-token', value: req.headers?.['x-auth-token'] },
    { source: 'header:access-token', value: req.headers?.['access-token'] },
    getCookieTokenEntry(req),
    { source: 'query:token', value: req.query?.token },
    { source: 'body:token', value: req.body?.token }
  ].filter(Boolean);

  return candidates.find((candidate) => candidate.value);
};

const buildAuthDebugContext = (req, source = null) => {
  const cookies = parseCookieHeader(req.headers?.cookie);
  return {
    method: req.method,
    path: req.originalUrl || req.url,
    origin: req.headers?.origin || null,
    host: req.headers?.host || null,
    referer: req.headers?.referer || null,
    source,
    presentHeaders: {
      authorization: Boolean(req.headers?.authorization),
      xAccessToken: Boolean(req.headers?.['x-access-token']),
      xToken: Boolean(req.headers?.['x-token']),
      token: Boolean(req.headers?.token),
      authToken: Boolean(req.headers?.['auth-token']),
      xAuthToken: Boolean(req.headers?.['x-auth-token']),
      accessToken: Boolean(req.headers?.['access-token']),
      cookie: Boolean(req.headers?.cookie)
    },
    accessControlRequestHeaders: req.headers?.['access-control-request-headers'] || null,
    queryHasToken: req.query?.token !== undefined,
    bodyHasToken: req.body?.token !== undefined,
    cookieKeys: Object.keys(cookies)
  };
};

const logAuthFailure = (req, reason, details = {}) => {
  if (!AUTH_DEBUG) return;
  console.warn(`[${TAG}] fallo autenticacion: ${reason}`, {
    ...buildAuthDebugContext(req, details.source || null),
    ...details
  });
};

const isInvalidToken = (token) =>
  !token || token === 'null' || token === 'undefined';

const unauthorized = (res, message) => res.status(401).json({ message });

const normalizeRoleName = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const isAdminRole = (roleInfo) => {
  if (!roleInfo) return false;
  const roleId = Number(roleInfo.id_rol);
  if (Number.isInteger(roleId) && roleId === ADMIN_ROLE_ID) return true;
  return normalizeRoleName(roleInfo.nombre) === ADMIN_ROLE_NAME;
};

const loadUserRoleInfo = async (userId) => {
  const links = await models.roles_usuarios.findAll({
    where: { id_usuario: userId },
    attributes: ['id_rol', 'id_rol_usuario'],
    include: [
      {
        model: models.rol,
        as: 'id_rol_rol',
        attributes: ['id_rol', 'nombre']
      }
    ],
    order: [['id_rol_usuario', 'ASC']]
  });

  if (!links.length) return null;

  const mappedRoles = links.map((link) => {
    const role = link.id_rol_rol;
    return role
      ? { id_rol: role.id_rol, nombre: role.nombre }
      : { id_rol: link.id_rol, nombre: null };
  });

  const adminRole = mappedRoles.find((roleInfo) => isAdminRole(roleInfo));
  return adminRole || mappedRoles[0];
};

const resolveUserIdFromDecoded = async (decoded) => {
  const directUserId = extractUserId(decoded);
  if (directUserId) {
    return directUserId;
  }

  const rawEmail = decoded?.email || decoded?.user?.email || decoded?.usuario?.email;
  const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';
  if (!email) {
    return null;
  }

  const user = await models.usuarios.findOne({
    where: sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), email),
    attributes: ['id_usuario']
  });

  const parsed = Number(user?.id_usuario);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildRequestUser = (decoded, userId, roleInfo) => {
  const base = decoded && typeof decoded === 'object' ? { ...decoded } : {};
  base.id = userId;
  if (base.id_usuario === undefined) {
    base.id_usuario = userId;
  }
  if (roleInfo) {
    base.role = roleInfo;
  }
  return base;
};

const shouldRefreshRoleToken = (decoded, roleInfo) => {
  if (!roleInfo) return false;
  const decodedRoleId = Number(decoded?.role?.id_rol);
  const currentRoleId = Number(roleInfo.id_rol);
  if (!Number.isInteger(currentRoleId)) return false;
  if (!Number.isInteger(decodedRoleId)) return true;
  return decodedRoleId !== currentRoleId;
};

const auth = async (req, res, next) => {
  try {
    if (req.method === 'OPTIONS') return next();

    const authHeaderEntry = getAuthHeader(req);
    if (!authHeaderEntry) {
      logAuthFailure(req, 'token_ausente');
      return unauthorized(res, 'No se proporciono un token, autorizacion denegada.');
    }

    const token = normalizeToken(authHeaderEntry.value);
    debugLog('token fuente:', authHeaderEntry.source);
    debugLog('token recibido:', maskToken(token));
    if (isInvalidToken(token)) {
      logAuthFailure(req, 'token_vacio_o_invalido', { source: authHeaderEntry.source });
      return unauthorized(res, 'No se proporciono un token, autorizacion denegada.');
    }

    let decoded;
    try {
      decoded = decodeToken(token);
    } catch (verifyError) {
      debugLog('token invalido:', verifyError?.name, verifyError?.message);
      logAuthFailure(req, 'token_no_verificable', {
        source: authHeaderEntry.source,
        verifyErrorName: verifyError?.name,
        verifyErrorMessage: verifyError?.message
      });
      return unauthorized(res, 'El token no es valido.');
    }

    const tokenUserId = await resolveUserIdFromDecoded(decoded);
    if (!tokenUserId) {
      logAuthFailure(req, 'token_sin_usuario_valido', { source: authHeaderEntry.source });
      return unauthorized(res, 'El token no contiene un usuario valido.');
    }

    let roleInfo = null;
    try {
      roleInfo = await loadUserRoleInfo(tokenUserId);
    } catch (roleError) {
      console.error(`[${TAG}] error cargando rol del usuario:`, roleError);
    }

    const finalPayload = buildRequestUser(decoded, tokenUserId, roleInfo);
    req.user = finalPayload;

    if (shouldRefreshRoleToken(decoded, roleInfo)) {
      res.set('x-refreshed-token', signUserToken(finalPayload));
    }

    return next();
  } catch (error) {
    console.error(`[${TAG}] error inesperado:`, error);
    logAuthFailure(req, 'error_inesperado', { errorMessage: error?.message || String(error) });
    return unauthorized(res, 'El token no es valido.');
  }
};

const optionalAuth = async (req, res, next) => {
  const authHeaderEntry = getAuthHeader(req);
  if (!authHeaderEntry) return next();

  try {
    const token = normalizeToken(authHeaderEntry.value);
    debugLog('optional token fuente:', authHeaderEntry.source);
    debugLog('optional token recibido:', maskToken(token));
    if (isInvalidToken(token)) {
      logAuthFailure(req, 'optional_token_vacio_o_invalido', { source: authHeaderEntry.source });
      return unauthorized(res, 'El token no es valido.');
    }

    const decoded = decodeToken(token);
    const tokenUserId = await resolveUserIdFromDecoded(decoded);
    if (!tokenUserId) {
      logAuthFailure(req, 'optional_token_sin_usuario_valido', { source: authHeaderEntry.source });
      return unauthorized(res, 'El token no contiene un usuario valido.');
    }

    let roleInfo = null;
    try {
      roleInfo = await loadUserRoleInfo(tokenUserId);
    } catch (roleError) {
      console.error(`[${TAG}] error cargando rol en optionalAuth:`, roleError);
    }

    req.user = buildRequestUser(decoded, tokenUserId, roleInfo);
    return next();
  } catch (error) {
    debugLog('optional token invalido:', error?.name, error?.message);
    logAuthFailure(req, 'optional_token_no_verificable', {
      source: authHeaderEntry.source,
      verifyErrorName: error?.name,
      verifyErrorMessage: error?.message
    });
    return unauthorized(res, 'El token no es valido.');
  }
};

const isAdmin = async (req, res, next) => {
  if (!req.user || !req.user.id) {
    return res.status(403).json({
      message: 'Acceso denegado. No se encontro informacion del usuario.'
    });
  }

  try {
    const userRoles = await models.roles_usuarios.findAll({
      where: { id_usuario: req.user.id },
      attributes: ['id_rol'],
      include: [
        {
          model: models.rol,
          as: 'id_rol_rol',
          attributes: ['id_rol', 'nombre']
        }
      ]
    });

    const isAdministrator = userRoles.some((roleUser) => {
      const roleId = Number(roleUser.id_rol ?? roleUser.id_rol_rol?.id_rol);
      const roleName = normalizeRoleName(roleUser.id_rol_rol?.nombre);
      return (Number.isInteger(roleId) && roleId === ADMIN_ROLE_ID) || roleName === ADMIN_ROLE_NAME;
    });

    if (!isAdministrator) {
      return res.status(403).json({
        message: 'Acceso denegado. Se requiere rol de Administrador.'
      });
    }

    return next();
  } catch (error) {
    console.error('[AUTH][isAdmin] Error al verificar rol de usuario:', error);
    return res.status(500).json({
      message: 'Error interno del servidor al verificar roles.'
    });
  }
};

module.exports = {
  auth,
  isAdmin,
  optionalAuth
};
