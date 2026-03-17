const initModels = require('../models/init-models');
const sequelize = require('../database');
const { Op } = require('sequelize');
const emailService = require('../services/email.service');

const models = initModels(sequelize);
const ESTADO_PENDIENTE_FALLBACK_IDS = [1, 3];
const PROVEEDOR_EMAIL_ATTRIBUTES = [
    'id_proveedor',
    'nombre_proveedor',
    'nombre_contacto',
    'email_proveedor',
    'telefono_proveedor'
];

const DETALLE_INCLUDE = [
    {
        model: models.compras,
        as: 'id_pedidos_compra'
    },
    {
        model: models.productos,
        as: 'id_productos_producto'
    }
];

const resolveEstadoIds = async ({ nombres = [], fallbackIds = [], transaction = null } = {}) => {
    const ids = new Set();
    fallbackIds.forEach((id) => {
        const parsed = Number(id);
        if (Number.isInteger(parsed)) ids.add(parsed);
    });
    if (Array.isArray(nombres) && nombres.length) {
        const rows = await models.estados.findAll({
            where: { estado: { [Op.in]: nombres } },
            attributes: ['id_estado'],
            ...(transaction ? { transaction } : {})
        });
        rows.forEach((row) => {
            const parsed = Number(row.id_estado);
            if (Number.isInteger(parsed)) ids.add(parsed);
        });
    }
    return [...ids];
};

const resolveBusinessCcEmail = (proveedorEmail) => {
    const businessEmail =
        process.env.BUSINESS_EMAIL || process.env.COMPANY_EMAIL || process.env.EMAIL_USER;
    if (!businessEmail) return undefined;

    if (
        proveedorEmail &&
        String(businessEmail).trim().toLowerCase() === String(proveedorEmail).trim().toLowerCase()
    ) {
        return undefined;
    }
    return businessEmail;
};

const sendPedidoModificadoEmailFromDetalle = async (compraId) => {
    const parsedCompraId = Number(compraId);
    if (!Number.isInteger(parsedCompraId) || parsedCompraId <= 0) {
        return false;
    }

    const estadoPendienteIds = await resolveEstadoIds({
        nombres: ['PENDIENTE'],
        fallbackIds: ESTADO_PENDIENTE_FALLBACK_IDS
    });
    const compra = await models.compras.findByPk(parsedCompraId, {
        attributes: ['id_pedido', 'id_estado', 'numero_pedido', 'fecha_pedido'],
        include: [
            {
                model: models.proveedores,
                as: 'id_proveedor_proveedore',
                attributes: PROVEEDOR_EMAIL_ATTRIBUTES
            }
        ]
    });
    if (!compra || !estadoPendienteIds.includes(Number(compra.id_estado))) {
        return false;
    }

    const proveedor = compra.id_proveedor_proveedore;
    const proveedorEmail = proveedor?.email_proveedor;
    if (!proveedorEmail) {
        return false;
    }

    const detalles = await models.detalles_pedidos.findAll({
        where: { id_pedidos: parsedCompraId },
        include: [
            {
                model: models.productos,
                as: 'id_productos_producto'
            }
        ]
    });

    return emailService.sendProveedorPedidoActualizadoEmail({
        to: proveedorEmail,
        cc: resolveBusinessCcEmail(proveedorEmail),
        proveedor,
        compra,
        detalles
    });
};

const computeSubtotal = ({ cantidad, precio_unitario }) => {
    const qty = Number(cantidad);
    const unit = Number(precio_unitario);
    if (!Number.isFinite(qty) || !Number.isFinite(unit)) {
        return null;
    }
    return qty * unit;
};

const getProductoUnitPrice = async (idProducto, transaction = null) => {
    const producto = await models.productos.findByPk(idProducto, {
        attributes: ['id_productos', 'precio_venta_producto'],
        ...(transaction ? { transaction } : {})
    });
    if (!producto) {
        return null;
    }
    const unitPrice = Number(producto.precio_venta_producto);
    return Number.isFinite(unitPrice) ? unitPrice : null;
};

const findDetalleWithRelations = (id, transaction = null) =>
    models.detalles_pedidos.findByPk(id, {
        include: DETALLE_INCLUDE,
        ...(transaction ? { transaction } : {})
    });

const sanitizeDetallePayload = (body = {}) => {
    const payload = {};
    if (body.id_pedidos !== undefined) payload.id_pedidos = body.id_pedidos;
    if (body.id_productos !== undefined) payload.id_productos = body.id_productos;
    if (body.cantidad !== undefined) payload.cantidad = body.cantidad;
    return payload;
};

const handleDetallePedidoError = (res, method, error, message) => {
    console.error(`[DetallesPedidos][${method}]`, error);
    return res.status(500).json({ message });
};

const getDetallesPedidos = async (_req, res) => {
    try {
        const detallesPedidos = await models.detalles_pedidos.findAll({
            include: DETALLE_INCLUDE
        });
        return res.status(200).json(detallesPedidos);
    } catch (error) {
        return handleDetallePedidoError(
            res,
            'getDetallesPedidos',
            error,
            'Error al obtener detalles de pedidos'
        );
    }
};

const getDetallePedidoById = async (req, res) => {
    try {
        const detalleId = req.detallePedido?.id_detalle_pedidos || req.params.id;
        const detallePedido = await findDetalleWithRelations(detalleId);
        if (!detallePedido) {
            return res.status(404).json({ message: 'Detalle de pedido no encontrado' });
        }
        return res.status(200).json(detallePedido);
    } catch (error) {
        return handleDetallePedidoError(
            res,
            'getDetallePedidoById',
            error,
            'Error al obtener detalle de pedido'
        );
    }
};

const createDetallePedido = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const payload = sanitizeDetallePayload(req.body);
        const unitPrice = await getProductoUnitPrice(payload.id_productos, transaction);
        const subtotal = computeSubtotal({
            cantidad: payload.cantidad,
            precio_unitario: unitPrice
        });
        if (subtotal === null) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'No se pudo calcular el subtotal con la cantidad y producto enviados'
            });
        }

        const newDetallePedido = await models.detalles_pedidos.create(
            {
                ...payload,
                subtotal
            },
            { transaction }
        );

        const detalleConRelaciones = await findDetalleWithRelations(
            newDetallePedido.id_detalle_pedidos,
            transaction
        );

        await transaction.commit();
        return res.status(201).json(detalleConRelaciones || newDetallePedido);
    } catch (error) {
        await transaction.rollback();
        return handleDetallePedidoError(
            res,
            'createDetallePedido',
            error,
            'Error al crear detalle de pedido'
        );
    }
};

const updateDetallePedido = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const detallePedido = await models.detalles_pedidos.findByPk(req.params.id, { transaction });
        if (!detallePedido) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Detalle de pedido no encontrado' });
        }

        const updatePayload = sanitizeDetallePayload(req.body);
        if (updatePayload.cantidad !== undefined || updatePayload.id_productos !== undefined) {
            const cantidad = updatePayload.cantidad ?? detallePedido.cantidad;
            const idProducto = updatePayload.id_productos ?? detallePedido.id_productos;
            const unitPrice = await getProductoUnitPrice(idProducto, transaction);
            const subtotal = computeSubtotal({
                cantidad,
                precio_unitario: unitPrice
            });
            if (subtotal === null) {
                await transaction.rollback();
                return res.status(400).json({
                    message: 'No se pudo recalcular subtotal con la cantidad y producto enviados'
                });
            }
            updatePayload.subtotal = subtotal;
        }

        await detallePedido.update(updatePayload, { transaction });

        const detalleConRelaciones = await findDetalleWithRelations(
            detallePedido.id_detalle_pedidos,
            transaction
        );

        await transaction.commit();

        sendPedidoModificadoEmailFromDetalle(detalleConRelaciones?.id_pedidos ?? detallePedido.id_pedidos)
            .then((ok) => {
                if (!ok) {
                    console.warn(
                        '[DetallesPedidos] No se envio correo de pedido modificado (pedido no pendiente o proveedor sin email).'
                    );
                    return;
                }
                console.log('[DetallesPedidos] Correo de pedido modificado enviado a proveedor y administrador.');
            })
            .catch((emailError) => {
                console.error('[DetallesPedidos] Error enviando correo de pedido modificado:', emailError);
            });

        return res.status(200).json(detalleConRelaciones || detallePedido);
    } catch (error) {
        await transaction.rollback();
        return handleDetallePedidoError(
            res,
            'updateDetallePedido',
            error,
            'Error al actualizar detalle de pedido'
        );
    }
};

const deleteDetallePedido = async (req, res) => {
    try {
        const detallePedido = req.detallePedido || (await models.detalles_pedidos.findByPk(req.params.id));
        if (!detallePedido) {
            return res.status(404).json({ message: 'Detalle de pedido no encontrado' });
        }

        await detallePedido.destroy();
        return res.status(200).json({ message: 'Detalle de pedido eliminado' });
    } catch (error) {
        return handleDetallePedidoError(
            res,
            'deleteDetallePedido',
            error,
            'Error al eliminar detalle de pedido'
        );
    }
};

module.exports = {
    getDetallesPedidos,
    getDetallePedidoById,
    createDetallePedido,
    updateDetallePedido,
    deleteDetallePedido
};
