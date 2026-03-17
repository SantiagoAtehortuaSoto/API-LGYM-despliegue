const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);
const ALLOWED_FIELDS = [
  'id_agenda',
  'id_usuario',
  'fecha_asistencia',
  'hora_ingreso',
  'hora_salida',
  'id_estado'
];

const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

const compareTimes = (start, end) => {
  if (!isValidTime(start) || !isValidTime(end)) return true;
  const [sh, sm, ss = 0] = start.split(':').map(Number);
  const [eh, em, es = 0] = end.split(':').map(Number);
  const startSeconds = sh * 3600 + sm * 60 + ss;
  const endSeconds = eh * 3600 + em * 60 + es;
  return endSeconds >= startSeconds;
};

const ensureAgendaExists = async (id_agenda) => {
  const agenda = await models.agenda.findByPk(id_agenda, { attributes: ['id_agenda'] });
  if (!agenda) throw new Error(`La agenda con id '${id_agenda}' no existe.`);
  return true;
};

const ensureUsuarioExists = async (id_usuario) => {
  const usuario = await models.usuarios.findByPk(id_usuario, { attributes: ['id_usuario'] });
  if (!usuario) throw new Error(`El usuario con id '${id_usuario}' no existe.`);
  return true;
};

const ensureEstadoExists = async (id_estado) => {
  const estado = await models.estados.findByPk(id_estado, { attributes: ['id_estado'] });
  if (!estado) throw new Error(`El estado con id '${id_estado}' no es valido.`);
  return true;
};

const isSet = (value) => value !== undefined && value !== null && value !== '';

const getFirstSet = (...values) => values.find(isSet);

const buildAsistenciaPayload = (body = {}) =>
  ALLOWED_FIELDS.reduce((acc, field) => {
    if (Object.prototype.hasOwnProperty.call(body, field) && body[field] !== undefined) {
      acc[field] = body[field];
    }
    return acc;
  }, {});

const normalizeAsistenciaClienteBody = (req, _res, next) => {
  if (!req.body || typeof req.body !== 'object') {
    return next();
  }

  req.body.id_agenda = getFirstSet(
    req.body.id_agenda,
    req.body.idAgenda,
    req.body.agenda_id,
    req.body.agenda?.id_agenda,
    req.body.id_agenda_agenda?.id_agenda,
    // Compatibilidad temporal con payload viejo basado en citas.
    req.body.id_cita,
    req.body.idCita,
    req.body.cita_id,
    req.body.cita?.id_cita,
    req.body.id_cita_cita?.id_cita
  );

  req.body.id_usuario = getFirstSet(
    req.body.id_usuario,
    req.body.idUsuario,
    req.body.usuario_id,
    req.body.usuario?.id_usuario,
    req.body.id_usuario_usuario?.id_usuario
  );

  req.body.id_estado = getFirstSet(
    req.body.id_estado,
    req.body.idEstado,
    req.body.estado?.id_estado,
    req.body.id_estado_estado?.id_estado
  );

  req.body.fecha_asistencia = getFirstSet(
    req.body.fecha_asistencia,
    req.body.fechaAsistencia
  );

  req.body.hora_ingreso = getFirstSet(
    req.body.hora_ingreso,
    req.body.horaIngreso
  );

  req.body.hora_salida = getFirstSet(
    req.body.hora_salida,
    req.body.horaSalida
  );

  // La PK es autoincremental, no debe venir del cliente.
  delete req.body.id_asistencia_clientes;
  delete req.body.idAsistenciaClientes;

  return next();
};

const checkAsistenciaClienteExists = [
  param('id')
    .isInt({ gt: 0 })
    .withMessage('El id debe ser numerico')
    .bail()
    .custom(async (id, { req }) => {
      const asistencia = await models.asistencia_clientes.findByPk(id);
      if (!asistencia) throw new Error('Asistencia no encontrada');
      req.asistenciaCliente = asistencia;
      req.asistenciaClienteId = asistencia.id_asistencia_clientes;
    }),
  validateResult
];

const attachCreatePayload = (req, _res, next) => {
  req.asistenciaClientePayload = buildAsistenciaPayload(req.body);
  return next();
};

const attachUpdatePayload = (req, res, next) => {
  const payload = buildAsistenciaPayload(req.body);
  if (!Object.keys(payload).length) {
    return res.status(400).json({
      message: 'Debes enviar al menos un campo valido para actualizar.'
    });
  }

  req.asistenciaClientePayload = payload;
  return next();
};

const validateAsistenciaClienteCreate = [
  normalizeAsistenciaClienteBody,
  check('id_agenda')
    .exists()
    .withMessage('id_agenda es requerido')
    .bail()
    .isInt({ gt: 0 })
    .withMessage('id_agenda debe ser numerico')
    .bail()
    .custom(ensureAgendaExists),
  check('id_usuario')
    .exists()
    .withMessage('id_usuario es requerido')
    .bail()
    .isInt({ gt: 0 })
    .withMessage('id_usuario debe ser numerico')
    .bail()
    .custom(ensureUsuarioExists),
  check('fecha_asistencia')
    .exists()
    .withMessage('fecha_asistencia es requerida')
    .bail()
    .isISO8601()
    .withMessage('fecha_asistencia debe ser una fecha valida (YYYY-MM-DD)'),
  check('hora_ingreso')
    .exists()
    .withMessage('hora_ingreso es requerida')
    .bail()
    .custom((value) => {
      if (!isValidTime(value)) {
        throw new Error('hora_ingreso debe tener formato HH:mm o HH:mm:ss');
      }
      return true;
    }),
  check('hora_salida')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (!isValidTime(value)) {
        throw new Error('hora_salida debe tener formato HH:mm o HH:mm:ss');
      }
      if (req.body.hora_ingreso && !compareTimes(req.body.hora_ingreso, value)) {
        throw new Error('hora_salida debe ser posterior o igual a hora_ingreso');
      }
      return true;
    }),
  check('id_estado')
    .exists()
    .withMessage('id_estado es requerido')
    .bail()
    .isInt({ gt: 0 })
    .withMessage('id_estado debe ser numerico')
    .bail()
    .custom(ensureEstadoExists),
  validateResult,
  attachCreatePayload
];

const validateAsistenciaClienteUpdate = [
  normalizeAsistenciaClienteBody,
  check('id_agenda')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('id_agenda debe ser numerico')
    .bail()
    .custom(ensureAgendaExists),
  check('id_usuario')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('id_usuario debe ser numerico')
    .bail()
    .custom(ensureUsuarioExists),
  check('fecha_asistencia')
    .optional()
    .isISO8601()
    .withMessage('fecha_asistencia debe ser una fecha valida (YYYY-MM-DD)'),
  check('hora_ingreso')
    .optional()
    .custom((value, { req }) => {
      if (!isValidTime(value)) {
        throw new Error('hora_ingreso debe tener formato HH:mm o HH:mm:ss');
      }
      if (req.body.hora_salida && !compareTimes(value, req.body.hora_salida)) {
        throw new Error('hora_salida debe ser posterior o igual a hora_ingreso');
      }
      return true;
    }),
  check('hora_salida')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (!isValidTime(value)) {
        throw new Error('hora_salida debe tener formato HH:mm o HH:mm:ss');
      }
      const start = req.body.hora_ingreso ?? req.asistenciaCliente?.hora_ingreso;
      if (start && !compareTimes(start, value)) {
        throw new Error('hora_salida debe ser posterior o igual a hora_ingreso');
      }
      return true;
    }),
  check('id_estado')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('id_estado debe ser numerico')
    .bail()
    .custom(ensureEstadoExists),
  validateResult,
  attachUpdatePayload
];

module.exports = {
  checkAsistenciaClienteExists,
  validateAsistenciaClienteCreate,
  validateAsistenciaClienteUpdate
};
