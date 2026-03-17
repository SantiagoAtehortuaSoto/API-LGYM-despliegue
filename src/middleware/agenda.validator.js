const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);
const ADMIN_ROLE_NAME = (process.env.ADMIN_ROLE_NAME || 'Administrador').toLowerCase();
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID || 1);
const ADMIN_USER_ID = Number(process.env.ADMIN_USER_ID || NaN);

const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

const isTodayOrFuture = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  date.setHours(0, 0, 0, 0);
  return date >= today;
};

const ensureUsuarioExists = async (id_usuario, label = 'usuario') => {
  const usuario = await models.usuarios.findByPk(id_usuario);
  if (!usuario) {
    throw new Error(`El ${label} con id '${id_usuario}' no existe.`);
  }
};

const ensureEstadoExists = async (id_estado) => {
  const estado = await models.estados.findByPk(id_estado);
  if (!estado) {
    throw new Error(`El estado con id '${id_estado}' no es valido.`);
  }
};

const compareTimes = (start, end) => {
  if (!isValidTime(start) || !isValidTime(end)) return true;
  const [sh, sm, ss = 0] = start.split(':').map(Number);
  const [eh, em, es = 0] = end.split(':').map(Number);
  const startSeconds = sh * 3600 + sm * 60 + ss;
  const endSeconds = eh * 3600 + em * 60 + es;
  return endSeconds > startSeconds;
};

const checkAgendaExists = [
  param('id')
    .isInt({ gt: 0 })
    .withMessage('El id de la agenda debe ser numerico')
    .bail()
    .custom(async (id, { req }) => {
      const agenda = await models.agenda.findByPk(id);
      if (!agenda) {
        throw new Error('Agenda no encontrada');
      }
      req.agenda = agenda;
    }),
  validateResult
];

const validateAgendaCreate = [
  check('id_cliente')
    .exists()
    .withMessage('El id_cliente es requerido')
    .bail()
    .isInt({ gt: 0 })
    .withMessage('El id_cliente debe ser numerico')
    .bail()
    .custom((value) => ensureUsuarioExists(value, 'cliente')),
  check('agenda_fecha')
    .exists()
    .withMessage('La agenda_fecha es requerida')
    .bail()
    .isISO8601()
    .withMessage('agenda_fecha debe ser una fecha valida (YYYY-MM-DD)')
    .bail()
    .custom((value) => {
      if (!isTodayOrFuture(value)) {
        throw new Error('agenda_fecha no puede ser anterior a hoy');
      }
      return true;
    }),
  check('hora_inicio')
    .exists()
    .withMessage('La hora_inicio es requerida')
    .bail()
    .custom((value) => {
      if (!isValidTime(value)) {
        throw new Error('hora_inicio debe tener formato HH:mm o HH:mm:ss');
      }
      return true;
    }),
  check('hora_fin')
    .exists()
    .withMessage('La hora_fin es requerida')
    .bail()
    .custom((value, { req }) => {
      if (!isValidTime(value)) {
        throw new Error('hora_fin debe tener formato HH:mm o HH:mm:ss');
      }
      if (req.body.hora_inicio && !compareTimes(req.body.hora_inicio, value)) {
        throw new Error('hora_fin debe ser posterior a hora_inicio');
      }
      return true;
    }),
  check('actividad_agenda')
    .exists()
    .withMessage('La actividad_agenda es requerida')
    .bail()
    .isString()
    .withMessage('actividad_agenda debe ser texto')
    .isLength({ max: 80 })
    .withMessage('actividad_agenda no debe superar 80 caracteres'),
  check('observacion_agenda')
    .optional()
    .isLength({ max: 200 })
    .withMessage('observacion_agenda no debe superar 200 caracteres'),
  check('id_empleado')
    .exists()
    .withMessage('El id_empleado es requerido')
    .bail()
    .isInt({ gt: 0 })
    .withMessage('El id_empleado debe ser numerico')
    .bail()
    .custom((value) => ensureUsuarioExists(value, 'empleado')),
  check('id_estado')
    .exists()
    .withMessage('El id_estado es requerido')
    .bail()
    .isInt({ gt: 0 })
    .withMessage('El id_estado debe ser numerico')
    .bail()
    .custom(ensureEstadoExists),
  validateResult
];

const validateAgendaUpdate = [
  check('id_cliente')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('El id_cliente debe ser numerico')
    .bail()
    .custom((value) => ensureUsuarioExists(value, 'cliente')),
  check('agenda_fecha')
    .optional()
    .isISO8601()
    .withMessage('agenda_fecha debe ser una fecha valida (YYYY-MM-DD)')
    .bail()
    .custom((value) => {
      if (!isTodayOrFuture(value)) {
        throw new Error('agenda_fecha no puede ser anterior a hoy');
      }
      return true;
    }),
  check('hora_inicio')
    .optional()
    .custom((value, { req }) => {
      if (!isValidTime(value)) {
        throw new Error('hora_inicio debe tener formato HH:mm o HH:mm:ss');
      }
      if (req.body.hora_fin && !compareTimes(value, req.body.hora_fin)) {
        throw new Error('hora_fin debe ser posterior a hora_inicio');
      }
      return true;
    }),
  check('hora_fin')
    .optional()
    .custom((value, { req }) => {
      if (!isValidTime(value)) {
        throw new Error('hora_fin debe tener formato HH:mm o HH:mm:ss');
      }
      const start = req.body.hora_inicio ?? req.agenda?.hora_inicio;
      if (start && !compareTimes(start, value)) {
        throw new Error('hora_fin debe ser posterior a hora_inicio');
      }
      return true;
    }),
  check('actividad_agenda')
    .optional()
    .isString()
    .withMessage('actividad_agenda debe ser texto')
    .isLength({ max: 80 })
    .withMessage('actividad_agenda no debe superar 80 caracteres'),
  check('observacion_agenda')
    .optional()
    .isLength({ max: 200 })
    .withMessage('observacion_agenda no debe superar 200 caracteres'),
  check('id_empleado')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('El id_empleado debe ser numerico')
    .bail()
    .custom((value) => ensureUsuarioExists(value, 'empleado')),
  check('id_estado')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('El id_estado debe ser numerico')
    .bail()
    .custom(ensureEstadoExists),
  validateResult
];

const requireAgendaRequester = (req, res, next) => {
  const requesterId = Number(req.user?.id);
  if (!Number.isInteger(requesterId) || requesterId <= 0) {
    return res.status(401).json({ message: 'No autenticado' });
  }
  req.requesterId = requesterId;
  return next();
};

const isAdminContext = (req) => {
  const requesterId = Number(req.requesterId ?? req.user?.id);
  if (Number.isInteger(ADMIN_USER_ID) && requesterId === ADMIN_USER_ID) {
    return true;
  }

  const roleId = Number(req.user?.role?.id_rol);
  if (Number.isInteger(roleId) && roleId === ADMIN_ROLE_ID) {
    return true;
  }

  const roleName = String(req.user?.role?.nombre || '').toLowerCase();
  return Boolean(roleName) && roleName === ADMIN_ROLE_NAME;
};

const authorizeAgendaOwnerOrAdmin = (req, res, next) => {
  if (!req.agenda) {
    return res.status(404).json({ message: 'Agenda no encontrada' });
  }

  const requesterId = Number(req.requesterId ?? req.user?.id);
  if (!isAdminContext(req) && Number(req.agenda.id_cliente) !== requesterId) {
    return res.status(403).json({ message: 'No puedes acceder a esta agenda' });
  }

  return next();
};

module.exports = {
  checkAgendaExists,
  validateAgendaCreate,
  validateAgendaUpdate,
  requireAgendaRequester,
  authorizeAgendaOwnerOrAdmin
};
