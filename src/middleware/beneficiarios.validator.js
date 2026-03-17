const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const ensureUsuarioExists = async (id_usuario) => {
    const user = await models.usuarios.findByPk(id_usuario);
    if (!user) {
        throw new Error('El usuario especificado no existe');
    }
};

const ensureMembresiaExists = async (id_membresia) => {
    const mem = await models.membresias.findByPk(id_membresia);
    if (!mem) {
        throw new Error('La membresia especificada no existe');
    }
};

const checkBeneficiarioExists = [
    param('id')
        .isInt({ gt: 0 }).withMessage('El parametro id debe ser numerico')
        .bail()
        .custom(async (id, { req }) => {
            const found = await models.detalles_cliente_beneficiarios.findByPk(id);
            if (!found) {
                throw new Error('Beneficiario no encontrado');
            }
            req.beneficiario = found;
        }),
    validateResult
];

const baseValidations = (isUpdate = false) => [
    (() => {
        const chain = check('id_usuario');
        if (isUpdate) {
            chain.optional();
        } else {
            chain.exists().withMessage('id_usuario es requerido').bail();
        }
        return chain
            .isInt({ gt: 0 }).withMessage('id_usuario debe ser numerico')
            .bail()
            .custom(async (value) => {
                await ensureUsuarioExists(value);
            });
    })(),
    (() => {
        const chain = check('id_relacion');
        if (isUpdate) {
            chain.optional();
        } else {
            chain.exists().withMessage('id_relacion es requerido').bail();
        }
        return chain
            .isInt({ gt: 0 }).withMessage('id_relacion debe ser numerico')
            .bail()
            .custom(async (value) => {
                await ensureUsuarioExists(value);
            });
    })(),
    check('id_membresia')
        .optional()
        .isInt({ gt: 0 }).withMessage('id_membresia debe ser numerico')
        .bail()
        .custom(async (value) => {
            await ensureMembresiaExists(value);
        }),
    check('id_estado_membresia')
        .optional()
        .isInt({ gt: 0 }).withMessage('id_estado_membresia debe ser numerico')
];

const validateBeneficiarioCreate = [
    ...baseValidations(false),
    validateResult
];

const validateBeneficiarioUpdate = [
    ...checkBeneficiarioExists,
    ...baseValidations(true),
    validateResult
];

const validateBeneficiarioUsuarioParam = [
    param('id_usuario')
        .isInt({ gt: 0 })
        .withMessage('"id_usuario" debe ser un entero positivo')
        .bail()
        .custom((value, { req }) => {
            req.targetUsuarioId = Number(value);
            return true;
        }),
    validateResult
];

const requireBeneficiariosRequester = (req, res, next) => {
    const requesterId = Number(req.user?.id);
    if (!Number.isInteger(requesterId) || requesterId <= 0) {
        return res.status(401).json({ message: 'No autenticado' });
    }
    req.requesterId = requesterId;
    return next();
};

const normalizeBooleanQueryValue = (value) => value === 'true' || value === '1';

const normalizeBeneficiariosQuery = (req, _res, next) => {
    req.onlySelf = normalizeBooleanQueryValue(req.query?.self);
    req.onlyActive = normalizeBooleanQueryValue(req.query?.activo);
    return next();
};

module.exports = {
    checkBeneficiarioExists,
    validateBeneficiarioCreate,
    validateBeneficiarioUpdate,
    validateBeneficiarioUsuarioParam,
    requireBeneficiariosRequester,
    normalizeBeneficiariosQuery
};
