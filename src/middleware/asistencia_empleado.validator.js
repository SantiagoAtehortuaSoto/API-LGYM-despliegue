const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);

const isValidTime = (value) => /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(value);

const compareTimes = (start, end) => {
  if (!isValidTime(start) || !isValidTime(end)) return true;
  const [sh, sm, ss = 0] = start.split(':').map(Number);
  const [eh, em, es = 0] = end.split(':').map(Number);
  const startSeconds = sh * 3600 + sm * 60 + ss;
  const endSeconds = eh * 3600 + em * 60 + es;
  return endSeconds >= startSeconds;
};

const ensureUsuarioExists = async (id_usuario) => {
  const usuario = await models.usuarios.findByPk(id_usuario);
  if (!usuario) throw new Error(`El usuario con id '${id_usuario}' no existe.`);
};

const ensureEstadoExists = async (id_estado) => {
  const estado = await models.estados.findByPk(id_estado);
  if (!estado) throw new Error(`El estado con id '${id_estado}' no es valido.`);
};

const checkAsistenciaEmpleadoExists = [
  param('id')
    .isInt({ gt: 0 })
    .withMessage('El id debe ser numerico')
    .bail()
    .custom(async (id, { req }) => {
      const asistencia = await models.asistencia_empleado.findByPk(id);
      if (!asistencia) throw new Error('Asistencia no encontrada');
      req.asistenciaEmpleado = asistencia;
    }),
  validateResult
];

const validateAsistenciaEmpleadoCreate = [
  check('id_usuario')
    .exists()
    .withMessage('id_usuario es requerido')
    .bail()
    .isInt({ gt: 0 })
    .withMessage('id_usuario debe ser numerico')
    .bail()
    .custom(ensureUsuarioExists),
  check('asistencia_fecha')
    .exists()
    .withMessage('asistencia_fecha es requerida')
    .bail()
    .isISO8601()
    .withMessage('asistencia_fecha debe ser una fecha valida (YYYY-MM-DD)'),
  check('hora_entrada_empleado')
    .optional({ nullable: true })
    .custom((value) => {
      if (!isValidTime(value)) {
        throw new Error('hora_entrada_empleado debe tener formato HH:mm o HH:mm:ss');
      }
      return true;
    }),
  check('hora_salida_empleado')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (!isValidTime(value)) {
        throw new Error('hora_salida_empleado debe tener formato HH:mm o HH:mm:ss');
      }
      if (req.body.hora_entrada_empleado && !compareTimes(req.body.hora_entrada_empleado, value)) {
        throw new Error('hora_salida_empleado debe ser posterior o igual a hora_entrada_empleado');
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
  check('observaciones')
    .optional({ nullable: true })
    .isLength({ max: 200 })
    .withMessage('observaciones no debe superar 200 caracteres'),
  validateResult
];

const validateAsistenciaEmpleadoUpdate = [
  check('id_usuario')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('id_usuario debe ser numerico')
    .bail()
    .custom(ensureUsuarioExists),
  check('asistencia_fecha')
    .optional()
    .isISO8601()
    .withMessage('asistencia_fecha debe ser una fecha valida (YYYY-MM-DD)'),
  check('hora_entrada_empleado')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (!isValidTime(value)) {
        throw new Error('hora_entrada_empleado debe tener formato HH:mm o HH:mm:ss');
      }
      if (req.body.hora_salida_empleado && !compareTimes(value, req.body.hora_salida_empleado)) {
        throw new Error('hora_salida_empleado debe ser posterior o igual a hora_entrada_empleado');
      }
      return true;
    }),
  check('hora_salida_empleado')
    .optional({ nullable: true })
    .custom((value, { req }) => {
      if (!isValidTime(value)) {
        throw new Error('hora_salida_empleado debe tener formato HH:mm o HH:mm:ss');
      }
      const start = req.body.hora_entrada_empleado ?? req.asistenciaEmpleado?.hora_entrada_empleado;
      if (start && !compareTimes(start, value)) {
        throw new Error('hora_salida_empleado debe ser posterior o igual a hora_entrada_empleado');
      }
      return true;
    }),
  check('id_estado')
    .optional()
    .isInt({ gt: 0 })
    .withMessage('id_estado debe ser numerico')
    .bail()
    .custom(ensureEstadoExists),
  check('observaciones')
    .optional({ nullable: true })
    .isLength({ max: 200 })
    .withMessage('observaciones no debe superar 200 caracteres'),
  validateResult
];

module.exports = {
  checkAsistenciaEmpleadoExists,
  validateAsistenciaEmpleadoCreate,
  validateAsistenciaEmpleadoUpdate
};
