const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const pickBeneficiosPayload = (body = {}) =>
    body.beneficios ??
    body.servicios ??
    body.beneficiosIds ??
    body.serviciosIds ??
    body.beneficios_ids ??
    body.servicios_ids;

const normalizeMembresiaPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = {};

    const nombre =
        body.nombre ??
        body.nombre_membresia ??
        body.nombreMembresia ??
        body.nombre_membresia_nombre;
    if (nombre !== undefined && nombre !== null) {
        normalized.nombre = String(nombre).trim();
    }

    const descripcion =
        body.descripcion ??
        body.descripcion_membresia ??
        body.descripcionMembresia;
    if (descripcion !== undefined && descripcion !== null) {
        normalized.descripcion = String(descripcion).trim();
    }

    const precioRaw =
        body.precioVenta ??
        body.precio_de_venta ??
        body.precio ??
        body.precioVentaMembresia;
    if (precioRaw !== undefined && precioRaw !== null && precioRaw !== '') {
        const normalizedPrice = typeof precioRaw === 'string' ? precioRaw.replace(',', '.').trim() : precioRaw;
        const parsedPrice = Number(normalizedPrice);
        normalized.precioVenta = Number.isNaN(parsedPrice) ? normalizedPrice : parsedPrice;
    }

    const estadoRaw =
        body.id_estado ??
        body.idEstado ??
        body.estadoId ??
        body.estado;
    if (estadoRaw !== undefined && estadoRaw !== null && estadoRaw !== '') {
        const estadoParsed = Number(estadoRaw);
        if (Number.isInteger(estadoParsed) && estadoParsed > 0) {
            normalized.id_estado = estadoParsed;
        } else {
            normalized.estado = String(estadoRaw).trim();
        }
    }

    const duracionRaw =
        body.duracion_dias ??
        body.duracionDias ??
        body.duracion ??
        body.duracion_membresia ??
        body.duracionMembresia;
    if (duracionRaw !== undefined) {
        if (duracionRaw === null || duracionRaw === '') {
            normalized.duracion_dias = null;
        } else {
            const parsedDuracion = Number(duracionRaw);
            normalized.duracion_dias = Number.isNaN(parsedDuracion) ? duracionRaw : parsedDuracion;
        }
    }

    const beneficiosRaw = pickBeneficiosPayload(body);
    if (beneficiosRaw !== undefined) {
        normalized.beneficios = beneficiosRaw;
    }

    req.body = normalized;
    next();
};

const ensureEstadoById = async (estadoId) => {
    const estado = await models.estados.findByPk(estadoId, { attributes: ['id_estado'] });
    if (!estado) {
        throw new Error(`El id_estado '${estadoId}' no es valido.`);
    }
    return estado.id_estado;
};

const ensureEstadoByName = async (estadoNombre) => {
    const estado = await models.estados.findOne({
        where: { estado: estadoNombre },
        attributes: ['id_estado']
    });
    if (!estado) {
        throw new Error(`El estado '${estadoNombre}' no es valido.`);
    }
    return estado.id_estado;
};

const resolveEstadoFromBody = async (req, res, next) => {
    try {
        if (req.body.id_estado !== undefined) {
            req.membresiaEstadoId = await ensureEstadoById(req.body.id_estado);
            return next();
        }

        if (req.body.estado !== undefined) {
            req.membresiaEstadoId = await ensureEstadoByName(req.body.estado);
            return next();
        }

        return next();
    } catch (error) {
        return res.status(400).json({
            message: error.message || 'Estado invalido para la membresia'
        });
    }
};

const ensureValidDuration = (value) => {
    if (value === null) return true;
    return Number.isInteger(Number(value)) && Number(value) > 0;
};

const checkMembresiaExists = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const membresia = await models.membresias.findByPk(id);
            if (!membresia) {
                throw new Error('Membresia no encontrada');
            }
            req.membresia = membresia;
            return true;
        }),
    validateResult
];

const validateMembresiaCreate = [
    check('nombre')
        .exists({ checkNull: true })
        .withMessage('El nombre de la membresia es requerido')
        .bail()
        .isString()
        .withMessage('El nombre de la membresia debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('El nombre de la membresia no puede estar vacio')
        .bail()
        .isLength({ max: 80 })
        .withMessage('El nombre de la membresia no debe superar 80 caracteres'),
    check('descripcion')
        .optional()
        .isString()
        .withMessage('La descripcion debe ser texto'),
    check('precioVenta')
        .exists({ checkNull: true })
        .withMessage('El precio de venta es requerido')
        .bail()
        .isFloat({ min: 0 })
        .withMessage('El precio de venta debe ser numerico y mayor o igual a 0'),
    check('duracion_dias')
        .optional({ nullable: true })
        .custom(ensureValidDuration)
        .withMessage('duracion_dias debe ser un entero mayor a 0 o null'),
    check('id_estado')
        .if((_value, { req }) => req.body.id_estado !== undefined)
        .isInt({ min: 1 })
        .withMessage('id_estado debe ser numerico y mayor a 0'),
    check('estado')
        .if((_value, { req }) => req.body.id_estado === undefined)
        .exists({ checkFalsy: true })
        .withMessage('Debe enviar estado o id_estado')
        .bail()
        .isString()
        .withMessage('estado debe ser texto'),
    resolveEstadoFromBody,
    validateResult
];

const validateMembresiaUpdatePayload = (req, res, next) => {
    const hasAllowedField = [
        'nombre',
        'descripcion',
        'precioVenta',
        'duracion_dias',
        'id_estado',
        'estado',
        'beneficios'
    ].some((field) => req.body[field] !== undefined);

    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }

    return next();
};

const validateMembresiaUpdate = [
    check('nombre')
        .optional()
        .isString()
        .withMessage('El nombre de la membresia debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('El nombre de la membresia no puede estar vacio')
        .bail()
        .isLength({ max: 80 })
        .withMessage('El nombre de la membresia no debe superar 80 caracteres'),
    check('descripcion')
        .optional()
        .isString()
        .withMessage('La descripcion debe ser texto'),
    check('precioVenta')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('El precio de venta debe ser numerico y mayor o igual a 0'),
    check('duracion_dias')
        .optional({ nullable: true })
        .custom(ensureValidDuration)
        .withMessage('duracion_dias debe ser un entero mayor a 0 o null'),
    check('id_estado')
        .optional()
        .isInt({ min: 1 })
        .withMessage('id_estado debe ser numerico y mayor a 0'),
    check('estado')
        .optional()
        .isString()
        .withMessage('estado debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('estado no puede estar vacio'),
    resolveEstadoFromBody,
    validateResult,
    validateMembresiaUpdatePayload
];

module.exports = {
    normalizeMembresiaPayload,
    checkMembresiaExists,
    validateMembresiaCreate,
    validateMembresiaUpdate
};
