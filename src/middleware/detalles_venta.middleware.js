const { param, query } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizeDetalleVentaListQuery = (req, _res, next) => {
    const rawQuery = req.query && typeof req.query === 'object' ? req.query : {};
    const filters = {};

    const rawPedidoId =
        rawQuery.id_pedido_cliente ?? rawQuery.pedidoId ?? rawQuery.id_pedido ?? rawQuery.idPedido;
    if (rawPedidoId !== undefined) {
        filters.id_pedido_cliente = Number(rawPedidoId);
    }

    const rawTipoVenta = rawQuery.tipo_venta ?? rawQuery.tipoVenta;
    if (rawTipoVenta !== undefined && rawTipoVenta !== null) {
        const parsedTipoVenta = String(rawTipoVenta).trim();
        if (parsedTipoVenta) {
            filters.tipo_venta = parsedTipoVenta;
        }
    }

    const rawLimit = rawQuery.limit;
    if (rawLimit !== undefined) {
        req.detallesVentaLimit = Number(rawLimit);
    }

    const rawOffset = rawQuery.offset;
    if (rawOffset !== undefined) {
        req.detallesVentaOffset = Number(rawOffset);
    }

    req.detallesVentaFilters = filters;
    next();
};

const validateDetallesVentaListQuery = [
    query('id_pedido_cliente')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"id_pedido_cliente" debe ser un entero positivo'),
    query('pedidoId')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"pedidoId" debe ser un entero positivo'),
    query('id_pedido')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"id_pedido" debe ser un entero positivo'),
    query('idPedido')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"idPedido" debe ser un entero positivo'),
    query('tipo_venta')
        .optional()
        .isString()
        .withMessage('"tipo_venta" debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('"tipo_venta" no puede estar vacio'),
    query('tipoVenta')
        .optional()
        .isString()
        .withMessage('"tipoVenta" debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('"tipoVenta" no puede estar vacio'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('"limit" debe ser un entero entre 1 y 500'),
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('"offset" debe ser un entero mayor o igual a 0'),
    validateResult,
    normalizeDetalleVentaListQuery
];

const checkDetalleVentaExists = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const detalle = await models.detalles_venta.findByPk(id, {
                attributes: ['id_detalle_venta']
            });
            if (!detalle) {
                throw new Error('Detalle de venta no encontrado');
            }
            req.detalleVenta = detalle;
            return true;
        }),
    validateResult
];

module.exports = {
    validateDetallesVentaListQuery,
    checkDetalleVentaExists
};
