const { check, param } = require('express-validator');
const { Op } = require('sequelize');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizeProveedorPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = {};

    const nit = body.nit_proveedor ?? body.nit;
    if (nit !== undefined && nit !== null && nit !== '') {
        const parsed = Number(nit);
        normalized.nit_proveedor = Number.isNaN(parsed) ? nit : parsed;
    }

    const nombreProveedor = body.nombre_proveedor ?? body.nombre;
    if (nombreProveedor !== undefined && nombreProveedor !== null) {
        normalized.nombre_proveedor = String(nombreProveedor).trim();
    }

    const telefonoProveedor = body.telefono_proveedor ?? body.telefono;
    if (telefonoProveedor !== undefined && telefonoProveedor !== null) {
        normalized.telefono_proveedor = String(telefonoProveedor).replace(/\s+/g, '').trim();
    }

    const nombreContacto = body.nombre_contacto ?? body.contacto ?? body.nombreContacto;
    if (nombreContacto !== undefined && nombreContacto !== null) {
        normalized.nombre_contacto = String(nombreContacto).trim();
    }

    const emailProveedor = body.email_proveedor ?? body.email;
    if (emailProveedor !== undefined && emailProveedor !== null) {
        normalized.email_proveedor = String(emailProveedor).trim().toLowerCase();
    }

    const direccionProveedor = body.direccion_proveedor ?? body.direccion;
    if (direccionProveedor !== undefined && direccionProveedor !== null) {
        normalized.direccion_proveedor = String(direccionProveedor).trim();
    }

    const ciudadProveedor = body.ciudad_proveedor ?? body.ciudad;
    if (ciudadProveedor !== undefined && ciudadProveedor !== null) {
        normalized.ciudad_proveedor = String(ciudadProveedor).trim();
    }

    const fechaRegistro = body.fecha_registro ?? body.fechaRegistro;
    if (fechaRegistro !== undefined && fechaRegistro !== null) {
        normalized.fecha_registro = String(fechaRegistro).trim();
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

const ensureNitDisponible = async (nit, proveedorId = null) => {
    const where = proveedorId
        ? { nit_proveedor: nit, id_proveedor: { [Op.ne]: proveedorId } }
        : { nit_proveedor: nit };
    const proveedor = await models.proveedores.findOne({
        where,
        attributes: ['id_proveedor']
    });
    if (proveedor) {
        throw new Error('El NIT ya esta registrado');
    }
    return true;
};

const checkProveedorExists = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const proveedor = await models.proveedores.findByPk(id);
            if (!proveedor) {
                throw new Error('Proveedor no encontrado');
            }
            req.proveedor = proveedor;
            return true;
        }),
    validateResult
];

const validateProveedorCreate = [
    check('nit_proveedor')
        .exists({ checkNull: true })
        .withMessage('El NIT es requerido')
        .bail()
        .isInt({ min: 1 })
        .withMessage('El NIT debe ser un entero positivo')
        .bail()
        .custom((value) => ensureNitDisponible(value)),
    check('nombre_proveedor')
        .exists({ checkNull: true })
        .withMessage('El nombre del proveedor es requerido')
        .bail()
        .isString()
        .withMessage('nombre_proveedor debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('nombre_proveedor no puede estar vacio')
        .bail()
        .isLength({ max: 80 })
        .withMessage('nombre_proveedor no debe superar 80 caracteres'),
    check('telefono_proveedor')
        .exists({ checkNull: true })
        .withMessage('El telefono del proveedor es requerido')
        .bail()
        .matches(/^[0-9]{7,10}$/)
        .withMessage('telefono_proveedor debe tener entre 7 y 10 digitos'),
    check('nombre_contacto')
        .exists({ checkNull: true })
        .withMessage('El nombre de contacto es requerido')
        .bail()
        .isString()
        .withMessage('nombre_contacto debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('nombre_contacto no puede estar vacio')
        .bail()
        .isLength({ max: 80 })
        .withMessage('nombre_contacto no debe superar 80 caracteres'),
    check('email_proveedor')
        .exists({ checkNull: true })
        .withMessage('El email del proveedor es requerido')
        .bail()
        .isEmail()
        .withMessage('email_proveedor debe ser un email valido')
        .bail()
        .isLength({ max: 80 })
        .withMessage('email_proveedor no debe superar 80 caracteres'),
    check('direccion_proveedor')
        .optional()
        .isString()
        .withMessage('direccion_proveedor debe ser texto')
        .bail()
        .isLength({ max: 80 })
        .withMessage('direccion_proveedor no debe superar 80 caracteres'),
    check('ciudad_proveedor')
        .optional()
        .isString()
        .withMessage('ciudad_proveedor debe ser texto')
        .bail()
        .isLength({ max: 80 })
        .withMessage('ciudad_proveedor no debe superar 80 caracteres'),
    check('fecha_registro')
        .exists({ checkNull: true })
        .withMessage('fecha_registro es requerida')
        .bail()
        .isISO8601()
        .withMessage('fecha_registro debe ser una fecha valida'),
    check('id_estado')
        .exists({ checkNull: true })
        .withMessage('id_estado es requerido')
        .bail()
        .isInt({ min: 1 })
        .withMessage('id_estado debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    validateResult
];

const validateProveedorUpdatePayload = (req, res, next) => {
    const hasAllowedField = [
        'nit_proveedor',
        'nombre_proveedor',
        'telefono_proveedor',
        'nombre_contacto',
        'email_proveedor',
        'direccion_proveedor',
        'ciudad_proveedor',
        'fecha_registro',
        'id_estado'
    ].some((field) => req.body[field] !== undefined);

    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }

    return next();
};

const validateProveedorUpdate = [
    check('nit_proveedor')
        .optional()
        .isInt({ min: 1 })
        .withMessage('nit_proveedor debe ser un entero positivo')
        .bail()
        .custom(async (value, { req }) => ensureNitDisponible(value, req.proveedor?.id_proveedor)),
    check('nombre_proveedor')
        .optional()
        .isString()
        .withMessage('nombre_proveedor debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('nombre_proveedor no puede estar vacio')
        .bail()
        .isLength({ max: 80 })
        .withMessage('nombre_proveedor no debe superar 80 caracteres'),
    check('telefono_proveedor')
        .optional()
        .matches(/^[0-9]{7,10}$/)
        .withMessage('telefono_proveedor debe tener entre 7 y 10 digitos'),
    check('nombre_contacto')
        .optional()
        .isString()
        .withMessage('nombre_contacto debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('nombre_contacto no puede estar vacio')
        .bail()
        .isLength({ max: 80 })
        .withMessage('nombre_contacto no debe superar 80 caracteres'),
    check('email_proveedor')
        .optional()
        .isEmail()
        .withMessage('email_proveedor debe ser un email valido')
        .bail()
        .isLength({ max: 80 })
        .withMessage('email_proveedor no debe superar 80 caracteres'),
    check('direccion_proveedor')
        .optional()
        .isString()
        .withMessage('direccion_proveedor debe ser texto')
        .bail()
        .isLength({ max: 80 })
        .withMessage('direccion_proveedor no debe superar 80 caracteres'),
    check('ciudad_proveedor')
        .optional()
        .isString()
        .withMessage('ciudad_proveedor debe ser texto')
        .bail()
        .isLength({ max: 80 })
        .withMessage('ciudad_proveedor no debe superar 80 caracteres'),
    check('fecha_registro')
        .optional()
        .isISO8601()
        .withMessage('fecha_registro debe ser una fecha valida'),
    check('id_estado')
        .optional()
        .isInt({ min: 1 })
        .withMessage('id_estado debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    validateResult,
    validateProveedorUpdatePayload
];

module.exports = {
    normalizeProveedorPayload,
    validateProveedorCreate,
    validateProveedorUpdate,
    checkProveedorExists
};
