const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const checkCaracteristicaExists = [
  param('id')
    .isInt({ gt: 0 })
    .withMessage('El id debe ser numerico')
    .bail()
    .custom(async (id, { req }) => {
      const caracteristica = await models.caracteristicas.findByPk(id);
      if (!caracteristica) {
        throw new Error('Caracteristica no encontrada');
      }
      req.caracteristica = caracteristica;
    }),
  validateResult
];

const validateCaracteristicaCreate = [
  check('propiedad')
    .exists()
    .withMessage('La propiedad es requerida')
    .bail()
    .isString()
    .withMessage('La propiedad debe ser texto')
    .isLength({ max: 200 })
    .withMessage('La propiedad no debe superar 200 caracteres'),
  validateResult
];

const validateCaracteristicaUpdate = [
  check('propiedad')
    .optional()
    .isString()
    .withMessage('La propiedad debe ser texto')
    .isLength({ max: 200 })
    .withMessage('La propiedad no debe superar 200 caracteres'),
  validateResult
];

module.exports = {
  checkCaracteristicaExists,
  validateCaracteristicaCreate,
  validateCaracteristicaUpdate
};
