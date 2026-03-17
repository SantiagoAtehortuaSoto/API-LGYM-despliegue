const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);

const normalizeSeguimientoPayload = (req, _res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const normalized = { ...body };

  const idUsuario = body.id_usuario ?? body.idUsuario ?? body.usuarioId ?? body.userId;
  if (idUsuario !== undefined && idUsuario !== null && idUsuario !== '') {
    const parsed = Number(idUsuario);
    normalized.id_usuario = Number.isNaN(parsed) ? idUsuario : parsed;
  }

  const deporte = body.deporte ?? body.sport;
  if (deporte !== undefined) {
    normalized.deporte = typeof deporte === 'string' ? deporte.trim() : deporte;
  }

  const actividad = body.actividad ?? body.activity;
  if (actividad !== undefined) {
    normalized.actividad = typeof actividad === 'string' ? actividad.trim() : actividad;
  }

  const fechaRegistro =
    body.fecha_registro ?? body.fechaRegistro ?? body.fecha ?? body.fechaSeguimiento;
  if (fechaRegistro !== undefined && fechaRegistro !== null && fechaRegistro !== '') {
    normalized.fecha_registro = fechaRegistro;
  }

  req.body = normalized;
  next();
};

const ensureUsuarioExists = async (id_usuario) => {
  const usuario = await models.usuarios.findByPk(id_usuario);
  if (!usuario) {
    throw new Error(`El usuario con id '${id_usuario}' no existe.`);
  }
};

const checkSeguimientoExists = [
  param('id')
    .isInt({ gt: 0 })
    .withMessage('El id debe ser numerico')
    .bail()
    .custom(async (id, { req }) => {
      const seguimiento = await models.seguimiento_deportivo.findByPk(id);
      if (!seguimiento) {
        throw new Error('Seguimiento no encontrado');
      }
      req.seguimiento = seguimiento;
      req.seguimientoId = seguimiento.id_seguimiento;
    }),
  validateResult
];

const validateSeguimientoCreate = [
  check('id_usuario')
    .exists()
    .withMessage('El id_usuario es requerido')
    .bail()
    .isInt({ gt: 0 })
    .withMessage('El id_usuario debe ser numerico')
    .bail()
    .custom(ensureUsuarioExists),
  check('deporte')
    .optional()
    .isString()
    .withMessage('deporte debe ser texto')
    .isLength({ max: 80 })
    .withMessage('deporte no debe superar 80 caracteres'),
  check('actividad')
    .optional()
    .isString()
    .withMessage('actividad debe ser texto')
    .isLength({ max: 80 })
    .withMessage('actividad no debe superar 80 caracteres'),
  check('fecha_registro')
    .exists()
    .withMessage('La fecha_registro es requerida')
    .bail()
    .isISO8601()
    .withMessage('fecha_registro debe ser una fecha valida (YYYY-MM-DD)'),
  validateResult,
  (req, _res, next) => {
    req.createSeguimientoPayload = {
      id_usuario: req.body.id_usuario,
      deporte: req.body.deporte,
      actividad: req.body.actividad,
      fecha_registro: req.body.fecha_registro
    };
    next();
  }
];

const validateSeguimientoUpdate = [
  check('id_usuario')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('El id_usuario debe ser numerico')
    .bail()
    .custom(ensureUsuarioExists),
  check('deporte')
    .optional()
    .isString()
    .withMessage('deporte debe ser texto')
    .isLength({ max: 80 })
    .withMessage('deporte no debe superar 80 caracteres'),
  check('actividad')
    .optional()
    .isString()
    .withMessage('actividad debe ser texto')
    .isLength({ max: 80 })
    .withMessage('actividad no debe superar 80 caracteres'),
  check('fecha_registro')
    .optional()
    .isISO8601()
    .withMessage('fecha_registro debe ser una fecha valida (YYYY-MM-DD)'),
  validateResult,
  (req, res, next) => {
    const payload = {};
    const fields = ['id_usuario', 'deporte', 'actividad', 'fecha_registro'];

    fields.forEach((field) => {
      if (req.body[field] !== undefined) {
        payload[field] = req.body[field];
      }
    });

    if (!Object.keys(payload).length) {
      return res.status(400).json({
        message: 'Debe enviar al menos un campo valido para actualizar.'
      });
    }

    req.updateSeguimientoPayload = payload;
    return next();
  }
];

module.exports = {
  normalizeSeguimientoPayload,
  checkSeguimientoExists,
  validateSeguimientoCreate,
  validateSeguimientoUpdate
};
