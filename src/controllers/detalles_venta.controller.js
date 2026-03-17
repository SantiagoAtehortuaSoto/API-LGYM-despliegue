const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const DETALLE_INCLUDE = [
    {
        model: models.pedidos_clientes,
        as: 'id_pedido_cliente_pedidos_cliente',
        attributes: ['id_pedido_cliente', 'id_usuario', 'id_estado', 'valor_total_venta', 'fecha_venta', 'plazo_maximo']
    },
    { model: models.productos, as: 'producto' },
    { model: models.membresias, as: 'membresia' },
    { model: models.servicios, as: 'servicio' }
];

const buildDetalleVentaWhere = (filters = {}) => {
    const where = {};
    if (filters.id_pedido_cliente !== undefined) {
        where.id_pedido_cliente = filters.id_pedido_cliente;
    }
    if (filters.tipo_venta !== undefined) {
        where.tipo_venta = filters.tipo_venta;
    }
    return where;
};

const handleDetalleVentaError = (res, method, error, message) => {
    console.error(`[DetallesVenta][${method}]`, error);
    return res.status(500).json({ message });
};

const getDetallesVenta = async (req, res) => {
    try {
        const where = buildDetalleVentaWhere(req.detallesVentaFilters);
        const detalles = await models.detalles_venta.findAll({
            include: DETALLE_INCLUDE,
            ...(Object.keys(where).length ? { where } : {}),
            ...(req.detallesVentaLimit !== undefined ? { limit: req.detallesVentaLimit } : {}),
            ...(req.detallesVentaOffset !== undefined ? { offset: req.detallesVentaOffset } : {}),
            order: [['id_detalle_venta', 'DESC']]
        });
        return res.status(200).json(detalles);
    } catch (error) {
        return handleDetalleVentaError(
            res,
            'getDetallesVenta',
            error,
            'Error al obtener los detalles de venta'
        );
    }
};

const getDetalleVentaById = async (req, res) => {
    try {
        const detalleId = req.detalleVenta?.id_detalle_venta || req.params.id;
        const detalle = await models.detalles_venta.findByPk(detalleId, {
            include: DETALLE_INCLUDE
        });
        if (!detalle) {
            return res.status(404).json({ message: 'Detalle de venta no encontrado' });
        }
        return res.status(200).json(detalle);
    } catch (error) {
        return handleDetalleVentaError(
            res,
            'getDetalleVentaById',
            error,
            'Error al obtener el detalle de venta'
        );
    }
};

module.exports = {
    getDetallesVenta,
    getDetalleVentaById
};
