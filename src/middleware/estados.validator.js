const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizeEstadoPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = {};

    const estado = body.estado ?? body.nombre ?? body.name;
    if (estado !== undefined && estado !== null) {
        normalized.estado = String(estado).trim();
    }

    const descripcion = body.descripcion ?? body.detalle ?? body.description;
    if (descripcion !== undefined && descripcion !== null) {
        normalized.descripcion = String(descripcion).trim();
    }

    req.body = normalized;
    next();
};

const checkEstadoExists = [
    param('id')
        .isInt({ min: 1 }).withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const estado = await models.estados.findByPk(id);
            if (!estado) {
                throw new Error('Estado no encontrado');
            }
            req.estado = estado;
            return true;
        }),
    validateResult
];

const validateEstadoCreate = [
    check('estado')
        .exists({ checkNull: true }).withMessage('"estado" es obligatorio')
        .bail()
        .isString().withMessage('"estado" debe ser texto')
        .bail()
        .notEmpty().withMessage('"estado" no puede estar vacio')
        .bail()
        .isLength({ max: 80 }).withMessage('"estado" no debe superar 80 caracteres'),
    check('descripcion')
        .exists({ checkNull: true }).withMessage('"descripcion" es obligatoria')
        .bail()
        .isString().withMessage('"descripcion" debe ser texto')
        .bail()
        .notEmpty().withMessage('"descripcion" no puede estar vacia')
        .bail()
        .isLength({ max: 200 }).withMessage('"descripcion" no debe superar 200 caracteres'),
    validateResult
];

const validateEstadoUpdatePayload = (req, res, next) => {
    const hasAllowedField =
        req.body.estado !== undefined ||
        req.body.descripcion !== undefined;

    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }

    return next();
};

const validateEstadoUpdate = [
    check('estado')
        .optional()
        .isString().withMessage('"estado" debe ser texto')
        .bail()
        .notEmpty().withMessage('"estado" no puede estar vacio')
        .bail()
        .isLength({ max: 80 }).withMessage('"estado" no debe superar 80 caracteres'),
    check('descripcion')
        .optional()
        .isString().withMessage('"descripcion" debe ser texto')
        .bail()
        .notEmpty().withMessage('"descripcion" no puede estar vacia')
        .bail()
        .isLength({ max: 200 }).withMessage('"descripcion" no debe superar 200 caracteres'),
    validateResult,
    validateEstadoUpdatePayload
];

module.exports = {
    normalizeEstadoPayload,
    checkEstadoExists,
    validateEstadoCreate,
    validateEstadoUpdate
};
