const { body, check } = require('express-validator');
const { validateResult } = require('./validator');
const {
  isAtLeastMinimumUserAge,
  getMinimumAgeValidationMessage
} = require('../utils/userAge');

const validateMinimumUserAge = (value) => {
  if (!isAtLeastMinimumUserAge(value)) {
    throw new Error(getMinimumAgeValidationMessage());
  }
  return true;
};

const validateUserCreate = [
  check('email')
    .exists({ checkFalsy: true })
    .withMessage('El email es requerido')
    .bail()
    .isEmail()
    .withMessage('Debe ser un email valido'),
  check('password')
    .exists({ checkFalsy: true })
    .withMessage('La contrasena es requerida')
    .bail()
    .isLength({ min: 6 })
    .withMessage('La contrasena debe tener al menos 6 caracteres'),
  check('fecha_nacimiento')
    .exists({ checkFalsy: true })
    .withMessage('La fecha_nacimiento es requerida')
    .bail()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('fecha_nacimiento debe ser una fecha valida (YYYY-MM-DD)')
    .bail()
    .custom(validateMinimumUserAge),
  validateResult
];

const validateUserBirthDateUpdate = [
  body('fecha_nacimiento')
    .optional()
    .isISO8601({ strict: true, strictSeparator: true })
    .withMessage('fecha_nacimiento debe ser una fecha valida (YYYY-MM-DD)')
    .bail()
    .custom(validateMinimumUserAge),
  validateResult
];

const validateLogin = [
  check('email')
    .exists({ checkFalsy: true })
    .withMessage('El email es requerido')
    .bail()
    .isEmail()
    .withMessage('Debe ser un email valido'),
  check('password')
    .exists({ checkFalsy: true })
    .withMessage('La contrasena es requerida'),
  validateResult
];

module.exports = {
  validateUserCreate,
  validateUserBirthDateUpdate,
  validateLogin
};
