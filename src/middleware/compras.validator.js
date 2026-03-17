const { check, validationResult } = require('express-validator');
const { Op } = require('sequelize');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);
const proveedores = models.proveedores;
const productos = models.productos;

const toIsoStringOrNull = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }

    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }

    return date.toISOString();
};

const normalizeDetallePayload = (detalle) => {
    if (!detalle || typeof detalle !== 'object') {
        return null;
    }

    const normalizedDetalle = {};
    const productoObj =
        detalle.producto ||
        detalle.productos ||
        detalle.id_productos_producto ||
        detalle.id_producto_producto ||
        null;

    const idProducto =
        detalle.id_productos ??
        detalle.id_producto ??
        detalle.idProducto ??
        detalle.productoId ??
        detalle.producto_id ??
        productoObj?.id_productos ??
        productoObj?.id_producto ??
        productoObj?.id ??
        null;

    if (idProducto !== null && idProducto !== undefined) {
        const parsedProducto = Number(idProducto);
        normalizedDetalle.id_productos = Number.isNaN(parsedProducto) ? idProducto : parsedProducto;
    }

    const cantidad = detalle.cantidad ?? detalle.qty ?? detalle.cant ?? detalle.quantity ?? null;
    if (cantidad !== null && cantidad !== undefined) {
        const parsedCantidad = Number(cantidad);
        normalizedDetalle.cantidad = Number.isNaN(parsedCantidad) ? cantidad : parsedCantidad;
    }

    return Object.keys(normalizedDetalle).length > 0 ? normalizedDetalle : null;
};

const normalizeCompraPayload = (req, _res, next) => {
    const original = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = { ...original };

    const numeroPedido =
        original.numero_pedido ??
        original.numeroPedido ??
        original.numeroOrden ??
        original.numero ??
        null;
    if (numeroPedido !== null) {
        normalized.numero_pedido = String(numeroPedido).trim();
    }

    const idProveedor =
        original.id_proveedor ??
        original.idProveedor ??
        original.proveedorId ??
        original.proveedor_id ??
        null;
    if (idProveedor !== null && idProveedor !== undefined) {
        const parsed = Number(idProveedor);
        normalized.id_proveedor = Number.isNaN(parsed) ? idProveedor : parsed;
    }

    const rawFechaPedido = original.fecha_pedido ?? original.fechaPedido;
    if (rawFechaPedido !== undefined && rawFechaPedido !== null && rawFechaPedido !== '') {
        const normalizedFechaPedido = toIsoStringOrNull(rawFechaPedido);
        normalized.fecha_pedido = normalizedFechaPedido || rawFechaPedido;
    } else if (req.method === 'POST') {
        normalized.fecha_pedido = new Date().toISOString();
    }

    if (original.fecha_entrega !== undefined || original.fechaEntrega !== undefined) {
        delete normalized.fecha_entrega;
        delete normalized.fechaEntrega;
    }

    const idEstado =
        original.id_estado ??
        original.idEstado ??
        original.estadoId ??
        original.estado_id ??
        null;
    if (idEstado !== null && idEstado !== undefined) {
        const parsedEstado = Number(idEstado);
        normalized.id_estado = Number.isNaN(parsedEstado) ? idEstado : parsedEstado;
    }

    const detallesSource = Array.isArray(original.detalles)
        ? original.detalles
        : Array.isArray(original.items)
        ? original.items
        : Array.isArray(original.productos)
        ? original.productos
        : Array.isArray(original.detalles_pedidos)
        ? original.detalles_pedidos
        : Array.isArray(original.detallesPedidos)
        ? original.detallesPedidos
        : Array.isArray(original.detalle_pedido)
        ? original.detalle_pedido
        : Array.isArray(original.detallePedido)
        ? original.detallePedido
        : null;

    if (detallesSource) {
        const normalizedDetalles = detallesSource
            .map((detalle) => normalizeDetallePayload(detalle))
            .filter(Boolean);
        if (normalizedDetalles.length > 0) {
            normalized.detalles = normalizedDetalles;
        }
    } else {
        const detalleBase =
            original.detalle && typeof original.detalle === 'object' && !Array.isArray(original.detalle)
                ? original.detalle
                : original.detalle_pedido && typeof original.detalle_pedido === 'object' && !Array.isArray(original.detalle_pedido)
                ? original.detalle_pedido
                : original.detallePedido && typeof original.detallePedido === 'object' && !Array.isArray(original.detallePedido)
                ? original.detallePedido
                : original;

        const singleDetalle = normalizeDetallePayload(detalleBase);
        if (singleDetalle) {
            normalized.detalles = [singleDetalle];
        }
    }

    req.body = normalized;
    next();
};

const ensureProveedorExists = async (value) => {
    const proveedor = await proveedores.findByPk(value, { attributes: ['id_proveedor'] });
    if (!proveedor) {
        return Promise.reject('El proveedor no existe');
    }
    return true;
};

const validateExpressResult = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    return next();
};

const validateDetalleProductosExistentes = async (req, res, next) => {
    const detalles = Array.isArray(req.body.detalles) ? req.body.detalles : [];
    if (!detalles.length) {
        return next();
    }

    const productIds = [
        ...new Set(
            detalles
                .map((detalle) => Number(detalle?.id_productos))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    ];

    if (!productIds.length) {
        return next();
    }

    try {
        const productosRows = await productos.findAll({
            where: { id_productos: { [Op.in]: productIds } },
            attributes: ['id_productos']
        });

        const existingIds = new Set(productosRows.map((row) => Number(row.id_productos)));
        const missingIds = productIds.filter((id) => !existingIds.has(id));

        if (missingIds.length) {
            return res.status(400).json({
                errors: [
                    {
                        msg: `Los productos no existen: ${missingIds.join(', ')}`,
                        path: 'detalles',
                        location: 'body'
                    }
                ]
            });
        }

        return next();
    } catch (error) {
        console.error('[Compras][validateDetalleProductosExistentes] Error validando productos:', error);
        return res.status(500).json({ message: 'Error validando los productos de la compra' });
    }
};

const buildCompraValidators = ({ isUpdate = false } = {}) => [
    isUpdate
        ? check('numero_pedido')
              .optional()
              .isString().withMessage('numero_pedido debe ser un texto')
              .bail()
              .notEmpty().withMessage('numero_pedido no puede estar vacio')
        : check('numero_pedido')
              .exists({ checkFalsy: true }).withMessage('numero_pedido es requerido')
              .bail()
              .isString().withMessage('numero_pedido debe ser un texto'),
    isUpdate
        ? check('id_proveedor')
              .optional()
              .isInt({ min: 1 }).withMessage('id_proveedor debe ser un entero positivo')
              .bail()
              .custom(ensureProveedorExists)
        : check('id_proveedor')
              .exists({ checkFalsy: true }).withMessage('id_proveedor es requerido')
              .bail()
              .isInt({ min: 1 }).withMessage('id_proveedor debe ser un entero positivo')
              .bail()
              .custom(ensureProveedorExists),
    check('fecha_pedido')
        .optional()
        .isISO8601().withMessage('fecha_pedido debe tener formato de fecha valido'),
    check('id_estado')
        .optional()
        .isInt({ min: 1 }).withMessage('id_estado debe ser un entero positivo'),
    check('detalles')
        .optional()
        .isArray({ min: 1 }).withMessage('detalles debe ser un arreglo con al menos un elemento'),
    check('detalles.*.id_productos')
        .if((_value, { req }) => Array.isArray(req.body.detalles))
        .isInt({ min: 1 }).withMessage('Cada detalle necesita un id_productos entero positivo'),
    check('detalles.*.cantidad')
        .if((_value, { req }) => Array.isArray(req.body.detalles))
        .isInt({ min: 1 }).withMessage('Cada detalle necesita una cantidad entera mayor a 0'),
    validateExpressResult,
    validateDetalleProductosExistentes
];

const validateCompraCreate = buildCompraValidators({ isUpdate: false });
const validateCompraUpdate = buildCompraValidators({ isUpdate: true });

module.exports = {
    normalizeCompraPayload,
    validateCompraCreate,
    validateCompraUpdate
};
