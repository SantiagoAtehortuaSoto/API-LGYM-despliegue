const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);
const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const pickFirstProvided = (obj, aliases = []) => {
  for (const alias of aliases) {
    if (hasOwn(obj, alias)) {
      return { found: true, value: obj[alias] };
    }
  }
  return { found: false, value: undefined };
};

const normalizeRelacionPayload = (req, _res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const normalized = {};

  const maestroInput = pickFirstProvided(body, [
    'id_maestro_p',
    'idMaestroP',
    'maestroId',
    'id_maestro'
  ]);
  const maestroId = maestroInput.value;
  if (maestroInput.found && maestroId !== null && maestroId !== '') {
    const parsed = Number(maestroId);
    normalized.id_maestro_p = Number.isNaN(parsed) ? maestroId : parsed;
  }

  const caracteristicaInput = pickFirstProvided(body, [
    'id_caracteristica',
    'idCaracteristica',
    'caracteristicaId'
  ]);
  const caracteristicaId = caracteristicaInput.value;
  if (caracteristicaInput.found && caracteristicaId !== null && caracteristicaId !== '') {
    const parsed = Number(caracteristicaId);
    normalized.id_caracteristica = Number.isNaN(parsed) ? caracteristicaId : parsed;
  }

  const valorInput = pickFirstProvided(body, ['valor', 'value']);
  const valor = valorInput.value;
  if (valorInput.found && valor !== null && valor !== '') {
    const normalizedValor = typeof valor === 'string' ? valor.replace(',', '.').trim() : valor;
    const parsed = Number(normalizedValor);
    normalized.valor = Number.isNaN(parsed) ? normalizedValor : parsed;
  } else if (valorInput.found && (valor === null || valor === '')) {
    normalized.valor = null;
  }

  const observacionesInput = pickFirstProvided(body, ['observaciones', 'observacion', 'notes']);
  const observaciones = observacionesInput.value;
  if (observacionesInput.found && observaciones === null) {
    normalized.observaciones = null;
  } else if (observacionesInput.found) {
    const trimmed = String(observaciones).trim();
    normalized.observaciones = trimmed === '' ? null : trimmed;
  }

  req.body = normalized;
  next();
};

const ensureMaestroExiste = async (id_maestro_p) => {
  const maestro = await models.maestro_parametros.findByPk(id_maestro_p, {
    attributes: ['id_parametros_s']
  });
  if (!maestro) throw new Error(`El maestro_parametro con id '${id_maestro_p}' no existe.`);
};

const ensureCaracteristicaExiste = async (id_caracteristica) => {
  const caracteristica = await models.caracteristicas.findByPk(id_caracteristica, {
    attributes: ['id_caracteristicas']
  });
  if (!caracteristica) throw new Error(`La caracteristica con id '${id_caracteristica}' no existe.`);
};

const checkRelacionExists = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El id debe ser numerico y mayor a 0')
    .bail()
    .custom(async (id, { req }) => {
      const relacion = await models.relacion_seguimiento_caracteristica.findByPk(id);
      if (!relacion) throw new Error('Relacion no encontrada');
      req.relacionSeguimiento = relacion;
      req.relacionSeguimientoId = relacion.id_relacion_seguimiento;
      return true;
    }),
  validateResult
];

const validateRelacionCreate = [
  check('id_maestro_p')
    .exists({ checkNull: true })
    .withMessage('id_maestro_p es requerido')
    .bail()
    .isInt({ min: 1 })
    .withMessage('id_maestro_p debe ser numerico y mayor a 0')
    .bail()
    .custom(ensureMaestroExiste),
  check('id_caracteristica')
    .exists({ checkNull: true })
    .withMessage('id_caracteristica es requerido')
    .bail()
    .isInt({ min: 1 })
    .withMessage('id_caracteristica debe ser numerico y mayor a 0')
    .bail()
    .custom(ensureCaracteristicaExiste),
  check('valor')
    .optional({ nullable: true })
    .isFloat()
    .withMessage('valor debe ser numerico'),
  check('observaciones')
    .optional({ nullable: true })
    .isString()
    .withMessage('observaciones debe ser texto')
    .bail()
    .isLength({ max: 200 })
    .withMessage('observaciones no debe superar 200 caracteres'),
  validateResult
];

const validateRelacionUpdatePayload = (req, res, next) => {
  const hasAllowedField = [
    'id_maestro_p',
    'id_caracteristica',
    'valor',
    'observaciones'
  ].some((field) => req.body[field] !== undefined);

  if (!hasAllowedField) {
    return res.status(400).json({
      message: 'Debes enviar al menos un campo valido para actualizar'
    });
  }

  return next();
};

const validateRelacionUpdate = [
  check('id_maestro_p')
    .optional()
    .isInt({ min: 1 })
    .withMessage('id_maestro_p debe ser numerico y mayor a 0')
    .bail()
    .custom(ensureMaestroExiste),
  check('id_caracteristica')
    .optional()
    .isInt({ min: 1 })
    .withMessage('id_caracteristica debe ser numerico y mayor a 0')
    .bail()
    .custom(ensureCaracteristicaExiste),
  check('valor')
    .optional({ nullable: true })
    .isFloat()
    .withMessage('valor debe ser numerico'),
  check('observaciones')
    .optional({ nullable: true })
    .isString()
    .withMessage('observaciones debe ser texto')
    .bail()
    .isLength({ max: 200 })
    .withMessage('observaciones no debe superar 200 caracteres'),
  validateResult,
  validateRelacionUpdatePayload
];

module.exports = {
  normalizeRelacionPayload,
  checkRelacionExists,
  validateRelacionCreate,
  validateRelacionUpdate
};
