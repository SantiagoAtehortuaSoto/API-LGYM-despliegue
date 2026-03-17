const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizeMaestroParametroPayload = (req, _res, next) => {
  const body = req.body && typeof req.body === 'object' ? req.body : {};
  const normalized = {};

  const parametro = body.parametro ?? body.nombre ?? body.name;
  if (parametro !== undefined && parametro !== null) {
    normalized.parametro = String(parametro).trim();
  }

  req.body = normalized;
  next();
};

const checkMaestroParametroExists = [
  param('id')
    .isInt({ min: 1 })
    .withMessage('El id debe ser numerico y mayor a 0')
    .bail()
    .custom(async (id, { req }) => {
      const maestroParametro = await models.maestro_parametros.findByPk(id);
      if (!maestroParametro) {
        throw new Error('Maestro parametro no encontrado');
      }
      req.maestroParametro = maestroParametro;
      return true;
    }),
  validateResult
];

const validateMaestroParametroCreate = [
  check('parametro')
    .exists({ checkNull: true })
    .withMessage('El campo parametro es requerido')
    .bail()
    .isString()
    .withMessage('parametro debe ser texto')
    .bail()
    .notEmpty()
    .withMessage('parametro no puede estar vacio')
    .bail()
    .isLength({ max: 200 })
    .withMessage('parametro no debe superar 200 caracteres'),
  validateResult
];

const validateMaestroParametroUpdatePayload = (req, res, next) => {
  if (req.body.parametro === undefined) {
    return res.status(400).json({
      message: 'Debes enviar al menos un campo valido para actualizar'
    });
  }
  return next();
};

const validateMaestroParametroUpdate = [
  check('parametro')
    .optional()
    .isString()
    .withMessage('parametro debe ser texto')
    .bail()
    .notEmpty()
    .withMessage('parametro no puede estar vacio')
    .bail()
    .isLength({ max: 200 })
    .withMessage('parametro no debe superar 200 caracteres'),
  validateResult,
  validateMaestroParametroUpdatePayload
];

module.exports = {
  normalizeMaestroParametroPayload,
  checkMaestroParametroExists,
  validateMaestroParametroCreate,
  validateMaestroParametroUpdate
};
