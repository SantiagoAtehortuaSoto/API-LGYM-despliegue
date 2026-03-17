const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizePrivilegioPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = {};

    const nombre = body.nombre ?? body.privilegio ?? body.accion ?? body.nombre_privilegio;
    if (nombre !== undefined && nombre !== null) {
        normalized.nombre = String(nombre).trim();
    }

    const idEstado = body.id_estado ?? body.idEstado ?? body.estadoId;
    if (idEstado !== undefined && idEstado !== null && idEstado !== '') {
        const parsed = Number(idEstado);
        normalized.id_estado = Number.isNaN(parsed) ? idEstado : parsed;
    }

    req.body = normalized;
    next();
};

const ensureEstadoExists = async (idEstado) => {
    const estado = await models.estados.findByPk(idEstado, { attributes: ['id_estado'] });
    if (!estado) {
        throw new Error(`El id_estado '${idEstado}' no es valido.`);
    }
    return true;
};

const checkPrivilegioExists = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const privilegio = await models.privilegios.findByPk(id);
            if (!privilegio) {
                throw new Error('Privilegio no encontrado');
            }
            req.privilegio = privilegio;
            return true;
        }),
    validateResult
];

const validatePrivilegioCreate = [
    check('nombre')
        .exists({ checkNull: true })
        .withMessage('"nombre" es obligatorio')
        .bail()
        .isString()
        .withMessage('"nombre" debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('"nombre" no puede estar vacio')
        .bail()
        .isLength({ max: 20 })
        .withMessage('"nombre" no debe superar 20 caracteres'),
    check('id_estado')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"id_estado" debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    validateResult
];

const validatePrivilegioUpdatePayload = (req, res, next) => {
    const hasAllowedField = req.body.nombre !== undefined || req.body.id_estado !== undefined;
    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }
    return next();
};

const validatePrivilegioUpdate = [
    check('nombre')
        .optional()
        .isString()
        .withMessage('"nombre" debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('"nombre" no puede estar vacio')
        .bail()
        .isLength({ max: 20 })
        .withMessage('"nombre" no debe superar 20 caracteres'),
    check('id_estado')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"id_estado" debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    validateResult,
    validatePrivilegioUpdatePayload
];

module.exports = {
    normalizePrivilegioPayload,
    checkPrivilegioExists,
    validatePrivilegioCreate,
    validatePrivilegioUpdate
};
