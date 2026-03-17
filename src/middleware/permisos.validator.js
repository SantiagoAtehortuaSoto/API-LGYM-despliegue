const { check, param, query } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizePermisoPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = {};

    const nombre = body.nombre ?? body.modulo ?? body.permiso ?? body.nombre_permiso;
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

const normalizePermisoQuery = (req, _res, next) => {
    const raw = req.query?.groupByModulo ?? req.query?.group_by_modulo;
    if (raw === undefined) {
        req.groupByModulo = false;
        return next();
    }

    const normalized = String(raw).trim().toLowerCase();
    req.groupByModulo = ['true', '1', 'yes', 'si'].includes(normalized);
    return next();
};

const ensureEstadoExists = async (idEstado) => {
    const estado = await models.estados.findByPk(idEstado, { attributes: ['id_estado'] });
    if (!estado) {
        throw new Error(`El id_estado '${idEstado}' no es valido.`);
    }
    return true;
};

const validatePermisoListQuery = [
    query('groupByModulo')
        .optional()
        .isBoolean()
        .withMessage('"groupByModulo" debe ser booleano'),
    query('group_by_modulo')
        .optional()
        .isBoolean()
        .withMessage('"group_by_modulo" debe ser booleano'),
    validateResult,
    normalizePermisoQuery
];

const checkPermisoExists = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const permiso = await models.permisos.findByPk(id);
            if (!permiso) {
                throw new Error('Permiso no encontrado');
            }
            req.permiso = permiso;
            return true;
        }),
    validateResult
];

const validatePermisoCreate = [
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
        .isLength({ max: 60 })
        .withMessage('"nombre" no debe superar 60 caracteres'),
    check('id_estado')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"id_estado" debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    validateResult
];

const validatePermisoUpdatePayload = (req, res, next) => {
    const hasAllowedField = req.body.nombre !== undefined || req.body.id_estado !== undefined;
    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }
    return next();
};

const validatePermisoUpdate = [
    check('nombre')
        .optional()
        .isString()
        .withMessage('"nombre" debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('"nombre" no puede estar vacio')
        .bail()
        .isLength({ max: 60 })
        .withMessage('"nombre" no debe superar 60 caracteres'),
    check('id_estado')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"id_estado" debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    validateResult,
    validatePermisoUpdatePayload
];

module.exports = {
    normalizePermisoPayload,
    validatePermisoListQuery,
    checkPermisoExists,
    validatePermisoCreate,
    validatePermisoUpdate
};
