const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizeProductPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = {};

    const nombre =
        body.nombre_producto ??
        body.nombre ??
        body.nombreProducto;
    if (nombre !== undefined && nombre !== null) {
        normalized.nombre_producto = String(nombre).trim();
    }

    const categoria = body.categoria ?? body.categoria_producto ?? body.category;
    if (categoria !== undefined && categoria !== null) {
        normalized.categoria = String(categoria).trim();
    }

    const descripcion =
        body.descripcion_producto ??
        body.descripcion ??
        body.description;
    if (descripcion !== undefined && descripcion !== null) {
        normalized.descripcion_producto = String(descripcion).trim();
    }

    const precioVenta =
        body.precio_venta_producto ??
        body.precioVenta ??
        body.precio ??
        body.precio_venta;
    if (precioVenta !== undefined && precioVenta !== null && precioVenta !== '') {
        const normalizedPrice = typeof precioVenta === 'string' ? precioVenta.replace(',', '.').trim() : precioVenta;
        const parsedPrice = Number(normalizedPrice);
        normalized.precio_venta_producto = Number.isNaN(parsedPrice) ? normalizedPrice : parsedPrice;
    }

    if (body.stock !== undefined && body.stock !== null && body.stock !== '') {
        const parsedStock = Number(body.stock);
        normalized.stock = Number.isNaN(parsedStock) ? body.stock : parsedStock;
    }

    const estadoId = body.id_estados ?? body.id_estado ?? body.idEstado ?? body.estadoId;
    if (estadoId !== undefined && estadoId !== null && estadoId !== '') {
        const parsedEstadoId = Number(estadoId);
        normalized.id_estados = Number.isNaN(parsedEstadoId) ? estadoId : parsedEstadoId;
    }

    const imagenUrl = body.imagen_url ?? body.imagenUrl ?? body.image_url ?? body.imageUrl;
    if (imagenUrl !== undefined && imagenUrl !== null) {
        normalized.imagen_url = String(imagenUrl).trim();
    }

    req.body = normalized;
    next();
};

const ensureEstadoExists = async (idEstado) => {
    const estado = await models.estados.findByPk(idEstado, { attributes: ['id_estado'] });
    if (!estado) {
        throw new Error(`El id_estados '${idEstado}' no es valido.`);
    }
    return true;
};

const checkProductExists = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const product = await models.productos.findByPk(id);
            if (!product) {
                throw new Error('Producto no encontrado');
            }
            req.product = product;
            return true;
        }),
    validateResult
];

const validateProductCreate = [
    check('nombre_producto')
        .exists({ checkNull: true })
        .withMessage('El nombre del producto es requerido')
        .bail()
        .isString()
        .withMessage('nombre_producto debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('nombre_producto no puede estar vacio')
        .bail()
        .isLength({ max: 80 })
        .withMessage('nombre_producto no debe superar 80 caracteres'),
    check('categoria')
        .optional()
        .isString()
        .withMessage('categoria debe ser texto')
        .bail()
        .isLength({ max: 80 })
        .withMessage('categoria no debe superar 80 caracteres'),
    check('descripcion_producto')
        .optional()
        .isString()
        .withMessage('descripcion_producto debe ser texto')
        .bail()
        .isLength({ max: 200 })
        .withMessage('descripcion_producto no debe superar 200 caracteres'),
    check('precio_venta_producto')
        .exists({ checkNull: true })
        .withMessage('El precio de venta es requerido')
        .bail()
        .isFloat({ min: 0 })
        .withMessage('precio_venta_producto debe ser numerico y mayor o igual a 0'),
    check('stock')
        .exists({ checkNull: true })
        .withMessage('El stock es requerido')
        .bail()
        .isInt({ min: 0 })
        .withMessage('stock debe ser un entero mayor o igual a 0'),
    check('id_estados')
        .exists({ checkNull: true })
        .withMessage('id_estados es requerido')
        .bail()
        .isInt({ min: 1 })
        .withMessage('id_estados debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    check('imagen_url')
        .optional()
        .isString()
        .withMessage('imagen_url debe ser texto')
        .bail()
        .isLength({ max: 255 })
        .withMessage('imagen_url no debe superar 255 caracteres'),
    validateResult
];

const validateProductUpdatePayload = (req, res, next) => {
    const hasAllowedField = [
        'nombre_producto',
        'categoria',
        'descripcion_producto',
        'precio_venta_producto',
        'stock',
        'id_estados',
        'imagen_url'
    ].some((field) => req.body[field] !== undefined);

    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }

    return next();
};

const validateProductUpdate = [
    check('nombre_producto')
        .optional()
        .isString()
        .withMessage('nombre_producto debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('nombre_producto no puede estar vacio')
        .bail()
        .isLength({ max: 80 })
        .withMessage('nombre_producto no debe superar 80 caracteres'),
    check('categoria')
        .optional()
        .isString()
        .withMessage('categoria debe ser texto')
        .bail()
        .isLength({ max: 80 })
        .withMessage('categoria no debe superar 80 caracteres'),
    check('descripcion_producto')
        .optional()
        .isString()
        .withMessage('descripcion_producto debe ser texto')
        .bail()
        .isLength({ max: 200 })
        .withMessage('descripcion_producto no debe superar 200 caracteres'),
    check('precio_venta_producto')
        .optional()
        .isFloat({ min: 0 })
        .withMessage('precio_venta_producto debe ser numerico y mayor o igual a 0'),
    check('stock')
        .optional()
        .isInt({ min: 0 })
        .withMessage('stock debe ser un entero mayor o igual a 0'),
    check('id_estados')
        .optional()
        .isInt({ min: 1 })
        .withMessage('id_estados debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    check('imagen_url')
        .optional()
        .isString()
        .withMessage('imagen_url debe ser texto')
        .bail()
        .isLength({ max: 255 })
        .withMessage('imagen_url no debe superar 255 caracteres'),
    validateResult,
    validateProductUpdatePayload
];

module.exports = {
    normalizeProductPayload,
    checkProductExists,
    validateProductCreate,
    validateProductUpdate
};
