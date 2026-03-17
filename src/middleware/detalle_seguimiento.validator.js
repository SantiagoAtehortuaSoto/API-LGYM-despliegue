const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);

const LEGACY_VALUE_FIELDS = ['valor_numerico', 'valor', 'value'];

const ensureSeguimientoExiste = async (id_seguimiento) => {
  const seguimiento = await models.seguimiento_deportivo.findByPk(id_seguimiento, {
    attributes: ['id_seguimiento']
  });
  if (!seguimiento) throw new Error(`El seguimiento_deportivo con id '${id_seguimiento}' no existe.`);
};

const ensureRelacionExiste = async (id_relacion) => {
  const relacion = await models.relacion_seguimiento_caracteristica.findByPk(id_relacion, {
    attributes: ['id_relacion_seguimiento']
  });
  if (!relacion) throw new Error(`La relacion_seguimiento_caracteristica con id '${id_relacion}' no existe.`);
};

const normalizeDetalleSeguimientoPayload = (req, _res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const normalized = { ...body };

  const seguimientoId = body.id_seguimiento ?? body.idSeguimiento ?? body.seguimientoId;
  if (seguimientoId !== undefined) {
    const parsedId = Number(seguimientoId);
    normalized.id_seguimiento = Number.isNaN(parsedId) ? seguimientoId : parsedId;
  }

  const relacionId =
    body.id_relacion_seguimiento ??
    body.idRelacionSeguimiento ??
    body.relacionSeguimientoId ??
    body.id_relacion;
  if (relacionId !== undefined) {
    const parsedId = Number(relacionId);
    normalized.id_relacion_seguimiento = Number.isNaN(parsedId) ? relacionId : parsedId;
  }

  req.body = normalized;
  next();
};

const validateUpdatePayload = (req, res, next) => {
  const hasAllowedField =
    req.body.id_seguimiento !== undefined ||
    req.body.id_relacion_seguimiento !== undefined;

  if (!hasAllowedField) {
    return res.status(400).json({
      message: 'Debes enviar al menos un campo valido para actualizar'
    });
  }

  return next();
};

const forbidLegacyValueFields = LEGACY_VALUE_FIELDS.map((field) =>
  check(field)
    .not()
    .exists()
    .withMessage(`${field} no aplica en detalle_seguimiento. Usa valor en relacion_seguimiento_caracteristica.`)
);

const checkDetalleSeguimientoExists = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El id debe ser numerico')
    .bail()
    .custom(async (id, { req }) => {
      const detalle = await models.detalle_seguimiento.findByPk(id);
      if (!detalle) throw new Error('Detalle de seguimiento no encontrado');
      req.detalleSeguimiento = detalle;
      return true;
    }),
  validateResult
];

const validateDetalleSeguimientoCreate = [
  normalizeDetalleSeguimientoPayload,
  check('id_seguimiento')
    .exists({ checkFalsy: true })
    .withMessage('id_seguimiento es requerido')
    .bail()
    .isInt({ min: 1 })
    .withMessage('id_seguimiento debe ser numerico')
    .bail()
    .custom(ensureSeguimientoExiste),
  check('id_relacion_seguimiento')
    .exists({ checkFalsy: true })
    .withMessage('id_relacion_seguimiento es requerido')
    .bail()
    .isInt({ min: 1 })
    .withMessage('id_relacion_seguimiento debe ser numerico')
    .bail()
    .custom(ensureRelacionExiste),
  ...forbidLegacyValueFields,
  validateResult
];

const validateDetalleSeguimientoUpdate = [
  normalizeDetalleSeguimientoPayload,
  check('id_seguimiento')
    .optional()
    .isInt({ min: 1 })
    .withMessage('id_seguimiento debe ser numerico')
    .bail()
    .custom(ensureSeguimientoExiste),
  check('id_relacion_seguimiento')
    .optional()
    .isInt({ min: 1 })
    .withMessage('id_relacion_seguimiento debe ser numerico')
    .bail()
    .custom(ensureRelacionExiste),
  ...forbidLegacyValueFields,
  validateResult,
  validateUpdatePayload
];

module.exports = {
  checkDetalleSeguimientoExists,
  validateDetalleSeguimientoCreate,
  validateDetalleSeguimientoUpdate
};
