const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizeDetallePedidoPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = { ...body };

    const compraId = body.id_pedidos ?? body.idPedido ?? body.pedidoId ?? body.id_compra;
    if (compraId !== undefined) {
        const parsedId = Number(compraId);
        normalized.id_pedidos = Number.isNaN(parsedId) ? compraId : parsedId;
    }

    const productoId = body.id_productos ?? body.idProducto ?? body.productoId ?? body.id_producto;
    if (productoId !== undefined) {
        const parsedId = Number(productoId);
        normalized.id_productos = Number.isNaN(parsedId) ? productoId : parsedId;
    }

    if (body.cantidad !== undefined) {
        const parsedCantidad = Number(body.cantidad);
        normalized.cantidad = Number.isNaN(parsedCantidad) ? body.cantidad : parsedCantidad;
    }

    req.body = normalized;
    next();
};

const ensureCompraExists = async (idCompra) => {
    const compra = await models.compras.findByPk(idCompra, { attributes: ['id_pedido'] });
    if (!compra) {
        return Promise.reject(`El pedido '${idCompra}' no es valido.`);
    }
    return true;
};

const ensureProductoExists = async (idProducto) => {
    const producto = await models.productos.findByPk(idProducto, { attributes: ['id_productos'] });
    if (!producto) {
        return Promise.reject(`El producto '${idProducto}' no es valido.`);
    }
    return true;
};

const checkDetallesPedidosExists = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El id debe ser un numero entero positivo')
        .bail()
        .custom(async (id, { req }) => {
            const detallePedido = await models.detalles_pedidos.findByPk(id);
            if (!detallePedido) {
                throw new Error('Detalle de pedido no encontrado');
            }
            req.detallePedido = detallePedido;
            return true;
        }),
    validateResult
];

const validateUpdatePayload = (req, res, next) => {
    const hasAllowedField =
        req.body.id_pedidos !== undefined ||
        req.body.id_productos !== undefined ||
        req.body.cantidad !== undefined;

    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }

    return next();
};

const buildDetallePedidoValidators = ({ isUpdate = false } = {}) => [
    normalizeDetallePedidoPayload,
    isUpdate
        ? check('id_pedidos')
              .optional()
              .isInt({ min: 1 })
              .withMessage('id_pedidos debe ser un entero positivo')
              .bail()
              .custom(ensureCompraExists)
        : check('id_pedidos')
              .exists({ checkFalsy: true })
              .withMessage('id_pedidos es requerido')
              .bail()
              .isInt({ min: 1 })
              .withMessage('id_pedidos debe ser un entero positivo')
              .bail()
              .custom(ensureCompraExists),
    isUpdate
        ? check('id_productos')
              .optional()
              .isInt({ min: 1 })
              .withMessage('id_productos debe ser un entero positivo')
              .bail()
              .custom(ensureProductoExists)
        : check('id_productos')
              .exists({ checkFalsy: true })
              .withMessage('id_productos es requerido')
              .bail()
              .isInt({ min: 1 })
              .withMessage('id_productos debe ser un entero positivo')
              .bail()
              .custom(ensureProductoExists),
    isUpdate
        ? check('cantidad')
              .optional()
              .isInt({ min: 1 })
              .withMessage('cantidad debe ser un entero mayor o igual a 1')
        : check('cantidad')
              .exists({ checkFalsy: true })
              .withMessage('cantidad es requerida')
              .bail()
              .isInt({ min: 1 })
              .withMessage('cantidad debe ser un entero mayor o igual a 1'),
    validateResult,
    ...(isUpdate ? [validateUpdatePayload] : [])
];

const validateDetallesPedidosCreate = buildDetallePedidoValidators({ isUpdate: false });
const validateDetallesPedidosUpdate = buildDetallePedidoValidators({ isUpdate: true });

module.exports = {
    checkDetallesPedidosExists,
    validateDetallesPedidosCreate,
    validateDetallesPedidosUpdate
};
