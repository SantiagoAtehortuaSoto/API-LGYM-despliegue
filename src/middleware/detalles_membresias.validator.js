const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizeDetalleMembresiaPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = { ...body };

    const membresiaId = body.id_membresia ?? body.idMembresia ?? body.membresiaId;
    if (membresiaId !== undefined) {
        const parsedId = Number(membresiaId);
        normalized.id_membresia = Number.isNaN(parsedId) ? membresiaId : parsedId;
    }

    const servicioId = body.id_servicio ?? body.idServicio ?? body.servicioId;
    if (servicioId !== undefined) {
        const parsedId = Number(servicioId);
        normalized.id_servicio = Number.isNaN(parsedId) ? servicioId : parsedId;
    }

    const estadoId = body.id_estado ?? body.idEstado ?? body.estadoId;
    if (estadoId !== undefined) {
        const parsedId = Number(estadoId);
        normalized.id_estado = Number.isNaN(parsedId) ? estadoId : parsedId;
    }

    req.body = normalized;
    next();
};

const ensureMembresiaExists = async (idMembresia) => {
    const membresiaExists = await models.membresias.findByPk(idMembresia, {
        attributes: ['id_membresias']
    });
    if (!membresiaExists) {
        return Promise.reject(`La membresia con id '${idMembresia}' no existe.`);
    }
    return true;
};

const ensureServicioExists = async (idServicio) => {
    const servicioExists = await models.servicios.findByPk(idServicio, {
        attributes: ['id_servicio']
    });
    if (!servicioExists) {
        return Promise.reject(`El servicio con id '${idServicio}' no existe.`);
    }
    return true;
};

const ensureEstadoExists = async (idEstado) => {
    const estadoExists = await models.estados.findByPk(idEstado, {
        attributes: ['id_estado']
    });
    if (!estadoExists) {
        return Promise.reject(`El estado con id '${idEstado}' no es valido.`);
    }
    return true;
};

const checkDetalleMembresiaExists = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El id debe ser un numero entero positivo')
        .bail()
        .custom(async (id, { req }) => {
            const detalle = await models.detalles_membresias.findByPk(id);
            if (!detalle) {
                throw new Error('Detalle de membresia no encontrado');
            }
            req.detalleMembresia = detalle;
            return true;
        }),
    validateResult
];

const validateUpdatePayload = (req, res, next) => {
    const hasAllowedField =
        req.body.id_membresia !== undefined ||
        req.body.id_servicio !== undefined ||
        req.body.id_estado !== undefined;

    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }

    return next();
};

const buildDetalleMembresiaValidators = ({ isUpdate = false } = {}) => [
    normalizeDetalleMembresiaPayload,
    isUpdate
        ? check('id_membresia')
              .optional()
              .isInt({ min: 1 })
              .withMessage('id_membresia debe ser un numero entero positivo')
              .bail()
              .custom(ensureMembresiaExists)
        : check('id_membresia')
              .exists({ checkFalsy: true })
              .withMessage('id_membresia es requerido')
              .bail()
              .isInt({ min: 1 })
              .withMessage('id_membresia debe ser un numero entero positivo')
              .bail()
              .custom(ensureMembresiaExists),
    isUpdate
        ? check('id_servicio')
              .optional()
              .isInt({ min: 1 })
              .withMessage('id_servicio debe ser un numero entero positivo')
              .bail()
              .custom(ensureServicioExists)
        : check('id_servicio')
              .exists({ checkFalsy: true })
              .withMessage('id_servicio es requerido')
              .bail()
              .isInt({ min: 1 })
              .withMessage('id_servicio debe ser un numero entero positivo')
              .bail()
              .custom(ensureServicioExists),
    isUpdate
        ? check('id_estado')
              .optional()
              .isInt({ min: 1 })
              .withMessage('id_estado debe ser un numero entero positivo')
              .bail()
              .custom(ensureEstadoExists)
        : check('id_estado')
              .exists({ checkFalsy: true })
              .withMessage('id_estado es requerido')
              .bail()
              .isInt({ min: 1 })
              .withMessage('id_estado debe ser un numero entero positivo')
              .bail()
              .custom(ensureEstadoExists),
    validateResult,
    ...(isUpdate ? [validateUpdatePayload] : [])
];

const validateDetalleMembresiaCreate = buildDetalleMembresiaValidators({ isUpdate: false });
const validateDetalleMembresiaUpdate = buildDetalleMembresiaValidators({ isUpdate: true });

module.exports = {
    checkDetalleMembresiaExists,
    validateDetalleMembresiaCreate,
    validateDetalleMembresiaUpdate
};
