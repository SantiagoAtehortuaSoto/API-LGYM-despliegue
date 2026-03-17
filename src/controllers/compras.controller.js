const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);
const compras = models.compras;
const detallesPedidos = models.detalles_pedidos;
const { Op } = require('sequelize');
const emailService = require('../services/email.service');

const ESTADO_COMPLETADO_ID = 5;
const ESTADO_CANCELADO_ID = 6;
const ESTADO_PENDIENTE_FALLBACK_IDS = [1, 3];
const ESTADO_FINAL_DEFAULT_IDS = [ESTADO_COMPLETADO_ID, ESTADO_CANCELADO_ID];
const PROVEEDOR_EMAIL_ATTRIBUTES = [
    'id_proveedor',
    'nombre_proveedor',
    'nombre_contacto',
    'email_proveedor',
    'telefono_proveedor'
];

const normalizeDetalleInput = (detalle = {}) => {
    if (!detalle || typeof detalle !== 'object') return null;

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

    const cantidad =
        detalle.cantidad ??
        detalle.qty ??
        detalle.cant ??
        detalle.quantity ??
        null;

    if (idProducto === null || cantidad === null) {
        return null;
    }

    const parsedProducto = Number(idProducto);
    const parsedCantidad = Number(cantidad);

    return {
        id_productos: Number.isNaN(parsedProducto) ? idProducto : parsedProducto,
        cantidad: Number.isNaN(parsedCantidad) ? cantidad : parsedCantidad
    };
};

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
            transaction
        });
        rows.forEach((row) => {
            const parsed = Number(row.id_estado);
            if (Number.isInteger(parsed)) ids.add(parsed);
        });
    }
    return [...ids];
};

const isFinalEstado = (id) => {
    const parsed = Number(id);
    return Number.isInteger(parsed) && (parsed === ESTADO_COMPLETADO_ID || parsed === ESTADO_CANCELADO_ID);
};

const buildCompraPayload = (body = {}, existingCompra = null) => {
    const payload = {};

    if (body.numero_pedido !== undefined) {
        payload.numero_pedido = body.numero_pedido;
    }
    if (body.id_proveedor !== undefined) {
        payload.id_proveedor = body.id_proveedor;
    }
    if (body.fecha_pedido !== undefined) {
        payload.fecha_pedido = body.fecha_pedido;
    }
    if (body.id_estado !== undefined) {
        payload.id_estado = body.id_estado;
    } else if (!existingCompra) {
        payload.id_estado = 1;
    }

    return payload;
};

const computeSubtotal = ({ cantidad, precio_unitario }) => {
    const qty = Number(cantidad);
    const unit = Number(precio_unitario);
    if (!Number.isFinite(qty) || !Number.isFinite(unit)) {
        return null;
    }
    return qty * unit;
};

const buildDetallesPayload = async (detalles = [], compraId, transaction = null) => {
    const normalizedDetalles = detalles.map((detalle, index) => {
        const normalizedDetalle = normalizeDetalleInput(detalle);
        if (!normalizedDetalle) {
            throw new Error(`Detalle incompleto en posicion #${index + 1}`);
        }
        return normalizedDetalle;
    });

    const productIds = [
        ...new Set(
            normalizedDetalles
                .map((detalle) => Number(detalle.id_productos))
                .filter((id) => Number.isInteger(id) && id > 0)
        )
    ];

    const productos = await models.productos.findAll({
        where: { id_productos: { [Op.in]: productIds } },
        attributes: ['id_productos', 'precio_venta_producto'],
        ...(transaction ? { transaction } : {})
    });
    const preciosByProducto = new Map(
        productos.map((producto) => [Number(producto.id_productos), Number(producto.precio_venta_producto)])
    );

    return normalizedDetalles.map((detalle, index) => {
        const unitPrice = preciosByProducto.get(Number(detalle.id_productos));
        const subtotal = computeSubtotal({
            cantidad: detalle.cantidad,
            precio_unitario: unitPrice
        });
        if (subtotal === null) {
            throw new Error(
                `No se pudo calcular el subtotal para el detalle #${index + 1} con el precio del producto`
            );
        }
        return {
            id_pedidos: compraId,
            id_productos: detalle.id_productos,
            cantidad: detalle.cantidad,
            subtotal
        };
    });
};

const buildSingleDetalleFromBody = (body = {}) => {
    const base =
        body.detalle && typeof body.detalle === 'object' && !Array.isArray(body.detalle)
            ? body.detalle
            : body.detalle_pedido && typeof body.detalle_pedido === 'object' && !Array.isArray(body.detalle_pedido)
            ? body.detalle_pedido
            : body.detallePedido && typeof body.detallePedido === 'object' && !Array.isArray(body.detallePedido)
            ? body.detallePedido
            : body;

    return normalizeDetalleInput(base);
};

const getCompraForProveedorEmail = async (compraId, transaction = null) =>
    compras.findByPk(compraId, {
        include: [
            {
                model: models.proveedores,
                as: 'id_proveedor_proveedore',
                attributes: PROVEEDOR_EMAIL_ATTRIBUTES
            }
        ],
        ...(transaction ? { transaction } : {})
    });

const getDetallesForProveedorEmail = async (compraId, transaction = null) =>
    detallesPedidos.findAll({
        where: { id_pedidos: compraId },
        include: [
            {
                model: models.productos,
                as: 'id_productos_producto'
            }
        ],
        ...(transaction ? { transaction } : {})
    });

const resolveBusinessCcEmail = (proveedorEmail) => {
    const businessEmail =
        process.env.BUSINESS_EMAIL || process.env.COMPANY_EMAIL || process.env.EMAIL_USER;

    if (!businessEmail) {
        return undefined;
    }
    if (
        proveedorEmail &&
        String(businessEmail).trim().toLowerCase() === String(proveedorEmail).trim().toLowerCase()
    ) {
        return undefined;
    }
    return businessEmail;
};

const sendCompraCorreoProveedor = async ({
    compraId,
    template = 'create',
    compraFallback = null,
    detallesFallback = null
}) => {
    const compraForEmail = (await getCompraForProveedorEmail(compraId)) ?? compraFallback;
    if (!compraForEmail) {
        return { ok: false, reason: 'compra_not_found' };
    }

    const detallesForEmail =
        Array.isArray(detallesFallback) && detallesFallback.length
            ? detallesFallback
            : await getDetallesForProveedorEmail(compraId);

    const proveedor = compraForEmail?.id_proveedor_proveedore;
    const proveedorEmail = proveedor?.email_proveedor;
    if (!proveedorEmail) {
        return { ok: false, reason: 'provider_without_email' };
    }

    const ccEmail = resolveBusinessCcEmail(proveedorEmail);
    const sendFn =
        template === 'update'
            ? emailService.sendProveedorPedidoActualizadoEmail
            : emailService.sendProveedorPedidoEmail;

    const emailSent = await sendFn({
        to: proveedorEmail,
        cc: ccEmail,
        proveedor,
        compra: compraForEmail,
        detalles: detallesForEmail
    });

    return { ok: emailSent, reason: emailSent ? null : 'send_failed' };
};

const toPositiveInt = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const firstPositiveInt = (values = []) => {
    for (const value of values) {
        const parsed = toPositiveInt(value);
        if (parsed) return parsed;
    }
    return null;
};

const resolveCompraIdFromCorreoRequest = async (req) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const query = req.query && typeof req.query === 'object' ? req.query : {};
    const params = req.params && typeof req.params === 'object' ? req.params : {};

    const compraIdFromBody = firstPositiveInt([
        body.id_pedido,
        body.idPedido,
        body.id_pedidos,
        body.pedidoId,
        body.compraId,
        body.id_compra,
        body.idCompra,
        body.compra_id,
        body.pedido_id,
        body.id,
        body.compra?.id_pedido,
        body.compra?.idPedido,
        body.compra?.id,
        body.compra?.id_compra,
        body.compra?.pedido_id,
        body.pedido?.id_pedido,
        body.pedido?.idPedido,
        body.pedido?.id,
        body.pedido?.id_compra,
        body.pedido?.pedido_id,
        body.pedido_data?.id_pedido,
        body.pedido_data?.idPedido,
        body.pedido_data?.id,
        body.pedido_data?.idCompra,
        body.data?.id_pedido,
        body.data?.idPedido,
        body.data?.id,
        body.data?.idCompra,
        body.data?.compraId,
        body.data?.compra_id,
        body.data?.pedidoId,
        body.data?.id_compra,
        body.data?.pedido_id,
        body.order?.id_pedido,
        body.order?.idPedido,
        body.order?.id,
        body.detallePedido?.id_pedido,
        body.detallePedido?.idPedido,
        body.detallePedido?.id,
        body.pedidoData?.id_pedido,
        body.pedidoData?.idPedido,
        body.pedidoData?.id,
        body.compraData?.id_pedido,
        body.compraData?.idPedido,
        body.compraData?.id
    ]);

    const compraIdFromQuery = firstPositiveInt([
        query.id_pedido,
        query.idPedido,
        query.pedidoId,
        query.compraId,
        query.compra_id,
        query.pedido_id,
        query.idCompra,
        query.compra,
        query.id
    ]);

    const compraIdFromParams = firstPositiveInt([
        params.id_pedido,
        params.idPedido,
        params.pedidoId,
        params.pedido_id,
        params.compra_id,
        params.compraId,
        params.id
    ]);

    const compraId = firstPositiveInt([compraIdFromBody, compraIdFromQuery, compraIdFromParams]);
    if (compraId) {
        return compraId;
    }

    const compra = await compras.findByPk(compraIdFromBody || compraIdFromQuery || compraIdFromParams, {
        attributes: ['id_pedido']
    });
    if (compra) {
        return toPositiveInt(compra?.id_pedido) || null;
    }

    const genericId = firstPositiveInt([
        body.id,
        query.id,
        params.id
    ]);
    if (genericId) {
        const compraByGeneric = await compras.findByPk(genericId, { attributes: ['id_pedido'] });
        if (compraByGeneric) {
            return genericId;
        }
    }

    const detalleId = firstPositiveInt([
        body.id_detalle_pedidos,
        body.idDetallePedido,
        body.detalleId,
        body.id_detalle,
        body.detalle?.id_detalle_pedidos,
        body.detalle?.idDetallePedido,
        query.id_detalle_pedidos,
        query.idDetallePedido,
        query.detalleId,
        params.id_detalle_pedidos,
        params.idDetallePedido,
        genericId
    ]);
    if (!detalleId) {
        return null;
    }

    const detalle = await models.detalles_pedidos.findByPk(detalleId, { attributes: ['id_pedidos'] });
    return toPositiveInt(detalle?.id_pedidos);
};

// Incrementa stock de productos según los detalles de una compra
const adjustStockFromCompra = async ({ id_pedido, transaction }) => {
    const detalles = await detallesPedidos.findAll({
        where: { id_pedidos: id_pedido },
        transaction,
        lock: transaction?.LOCK?.UPDATE
    });
    if (!detalles.length) return;

    const quantities = new Map();
    detalles.forEach((d) => {
        const pid = Number(d.id_productos);
        const qty = Number(d.cantidad);
        if (Number.isInteger(pid) && pid > 0 && Number.isFinite(qty) && qty > 0) {
            quantities.set(pid, (quantities.get(pid) || 0) + qty);
        }
    });
    if (!quantities.size) return;

    const productIds = [...quantities.keys()];
    const products = await models.productos.findAll({
        where: { id_productos: { [Op.in]: productIds } },
        transaction,
        lock: transaction?.LOCK?.UPDATE
    });
    const productsMap = new Map(products.map((p) => [p.id_productos, p]));

    for (const [pid, qty] of quantities.entries()) {
        const prod = productsMap.get(pid);
        if (!prod) continue;
        const current = Number(prod.stock) || 0;
        prod.stock = current + qty;
        await prod.save({ transaction });
    }
};

const createCompra = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const payload = buildCompraPayload(req.body);
        let detalles = Array.isArray(req.body.detalles) ? req.body.detalles : [];
        if (detalles.length === 0) {
            const fallbackDetalle = buildSingleDetalleFromBody(req.body);
            if (fallbackDetalle) {
                detalles = [fallbackDetalle];
            }
        }
        console.log('[Compras] detalles recibidos:', Array.isArray(detalles) ? detalles.length : 0);

        const newCompra = await compras.create(payload, { transaction });

        if (detalles.length > 0) {
            const detallesPayload = await buildDetallesPayload(detalles, newCompra.id_pedido, transaction);
            await detallesPedidos.bulkCreate(detallesPayload, { transaction });
        }

        const compraConDetalles = await compras.findByPk(newCompra.id_pedido, {
            include: [
                {
                    model: detallesPedidos,
                    as: 'detalles_pedidos',
                    include: [
                        {
                            model: models.productos,
                            as: 'id_productos_producto'
                        }
                    ]
                },
                {
                    model: models.proveedores,
                    as: 'id_proveedor_proveedore',
                    attributes: [
                        'id_proveedor',
                        'nombre_proveedor',
                        'nombre_contacto',
                        'email_proveedor',
                        'telefono_proveedor'
                    ]
                }
            ],
            transaction
        });

        await transaction.commit();

        const compraForEmail =
            (await getCompraForProveedorEmail(newCompra.id_pedido)) ?? compraConDetalles ?? newCompra;

        const detallesForEmail =
            Array.isArray(compraConDetalles?.detalles_pedidos) && compraConDetalles.detalles_pedidos.length
                ? compraConDetalles.detalles_pedidos
                : await getDetallesForProveedorEmail(newCompra.id_pedido);

        console.log('[Compras] detalles para email:', Array.isArray(detallesForEmail) ? detallesForEmail.length : 0);

        sendCompraCorreoProveedor({
            compraId: newCompra.id_pedido,
            template: 'create',
            compraFallback: compraForEmail ?? newCompra,
            detallesFallback: detallesForEmail
        })
            .then(({ ok, reason }) => {
                if (!ok) {
                    if (reason === 'provider_without_email') {
                        console.warn('[Compras] Proveedor sin email, no se envio correo de pedido.');
                        return;
                    }
                    console.error('[Compras] No se pudo enviar email de pedido al proveedor.');
                    return;
                }
                console.log('[Compras] Email de pedido enviado a proveedor.');
            })
            .catch((err) => {
                console.error('[Compras] Error enviando email de pedido:', err);
            });

        res.status(201).json(compraConDetalles ?? newCompra);
    } catch (error) {
        await transaction.rollback();
        res.status(500).json({ error: error.message });
    }
};

const getCompras = async (req, res) => {
    try {
        const allCompras = await compras.findAll();
        res.status(200).json(allCompras);
    } catch (error) {
        console.error('[Compras][getCompras] Error al obtener compras:', error);
        res.status(500).json({ error: error.message });
    }
};

const getComprasPendientes = async (req, res) => {
    try {
        const estadoIds = await resolveEstadoIds({
            nombres: ['PENDIENTE'],
            fallbackIds: ESTADO_PENDIENTE_FALLBACK_IDS
        });
        const comprasPendientes = await compras.findAll({
            where: { id_estado: { [Op.in]: estadoIds } }
        });
        res.status(200).json(comprasPendientes);
    } catch (error) {
        console.error('[Compras][getComprasPendientes] Error al obtener compras pendientes:', error);
        res.status(500).json({ error: error.message });
    }
};

const getComprasFinalizadas = async (req, res) => {
    try {
        const estadoIds = await resolveEstadoIds({
            nombres: ['COMPLETADO', 'CANCELADO', 'RECHAZADO'],
            fallbackIds: ESTADO_FINAL_DEFAULT_IDS
        });
        const comprasFinalizadas = await compras.findAll({
            where: { id_estado: { [Op.in]: estadoIds } }
        });
        res.status(200).json(comprasFinalizadas);
    } catch (error) {
        console.error('[Compras][getComprasFinalizadas] Error al obtener compras finalizadas:', error);
        res.status(500).json({ error: error.message });
    }
};

const getCompraById = async (req, res) => {
    try {
        const compra = await compras.findByPk(req.params.id);
        if (compra) {
            res.status(200).json(compra);
        } else {
            res.status(404).json({ message: 'Compra no encontrada' });
        }
    } catch (error) {
        console.error('[Compras][getCompraById] Error al obtener compra por id:', error);
        res.status(500).json({ error: error.message });
    }
};

const updateCompra = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const compra = await compras.findByPk(req.params.id, { transaction, lock: transaction.LOCK.UPDATE });
        if (!compra) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Compra no encontrada' });
        }

        const estadoActual = compra.id_estado;
        const payload = buildCompraPayload(req.body, compra);
        const estadoNuevo = payload.id_estado;

        // Bloqueo de cambios de estado si ya está final (completado/cancelado) y se intenta otro estado
        if (isFinalEstado(estadoActual) && estadoNuevo !== undefined && Number(estadoNuevo) !== Number(estadoActual)) {
            await transaction.rollback();
            return res.status(400).json({ message: 'No se puede modificar el estado de una compra completada o cancelada' });
        }

        let debeSumarStock = false;
        if (!isFinalEstado(estadoActual) && isFinalEstado(estadoNuevo) && Number(estadoNuevo) === ESTADO_COMPLETADO_ID) {
            debeSumarStock = true;
        }

        await compra.update(payload, { transaction });

        if (debeSumarStock) {
            await adjustStockFromCompra({ id_pedido: compra.id_pedido, transaction });
        }

        await transaction.commit();
        const updatedCompra = await compras.findByPk(req.params.id);

        const estadoPendienteIds = await resolveEstadoIds({
            nombres: ['PENDIENTE'],
            fallbackIds: ESTADO_PENDIENTE_FALLBACK_IDS
        });
        const estadoFinal = Number(estadoNuevo ?? estadoActual);
        const shouldNotifyUpdate = estadoPendienteIds.includes(estadoFinal);
        if (shouldNotifyUpdate) {
            sendCompraCorreoProveedor({
                compraId: compra.id_pedido,
                template: 'update',
                compraFallback: updatedCompra ?? compra
            })
                .then(({ ok, reason }) => {
                    if (!ok) {
                        if (reason === 'provider_without_email') {
                            console.warn('[Compras] Proveedor sin email, no se envio correo de pedido modificado.');
                            return;
                        }
                        console.error('[Compras] No se pudo enviar email de pedido modificado.');
                        return;
                    }
                    console.log('[Compras] Email de pedido modificado enviado a proveedor.');
                })
                .catch((emailError) => {
                    console.error('[Compras] Error enviando email de pedido modificado:', emailError);
                });
        }

        res.status(200).json(updatedCompra);
    } catch (error) {
        await transaction.rollback();
        console.error('[Compras][updateCompra] Error al actualizar compra:', error);
        res.status(500).json({ error: error.message });
    }
};

const enviarCorreoProveedorPedido = async (req, res) => {
    try {
        const compraId = await resolveCompraIdFromCorreoRequest(req);
        if (!compraId) {
            return res.status(400).json({ message: 'Debes enviar un id_pedido valido' });
        }

        const compra = await compras.findByPk(compraId, {
            attributes: ['id_pedido', 'id_estado', 'numero_pedido', 'fecha_pedido']
        });
        if (!compra) {
            return res.status(404).json({ message: 'Compra no encontrada' });
        }

        const tipoRaw = String(req.body?.tipo ?? req.query?.tipo ?? '').trim().toLowerCase();
        const template = ['creado', 'creacion', 'nuevo', 'create'].includes(tipoRaw)
            ? 'create'
            : 'update';

        if (template === 'update') {
            const estadoPendienteIds = await resolveEstadoIds({
                nombres: ['PENDIENTE'],
                fallbackIds: ESTADO_PENDIENTE_FALLBACK_IDS
            });
            if (!estadoPendienteIds.includes(Number(compra.id_estado))) {
                return res.status(400).json({
                    message: 'Solo se puede enviar este correo cuando el pedido esta pendiente de aprobacion'
                });
            }
        }

        const { ok, reason } = await sendCompraCorreoProveedor({
            compraId,
            template,
            compraFallback: compra
        });

        if (!ok) {
            if (reason === 'provider_without_email') {
                return res.status(400).json({ message: 'El proveedor no tiene un correo configurado' });
            }
            if (reason === 'compra_not_found') {
                return res.status(404).json({ message: 'Compra no encontrada' });
            }
            return res.status(500).json({ message: 'No se pudo enviar el correo del pedido' });
        }

        const successMessage =
            template === 'update'
                ? 'Correo de pedido modificado enviado a proveedor y administrador'
                : 'Correo de pedido enviado a proveedor y administrador';

        return res.status(200).json({ message: successMessage });
    } catch (error) {
        console.error('[Compras][enviarCorreoProveedorPedido] Error:', error);
        return res.status(500).json({ message: 'Error enviando correo del pedido' });
    }
};

const deleteCompra = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const compra = await compras.findByPk(req.params.id, { transaction });
        if (!compra) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Compra no encontrada' });
        }

        await detallesPedidos.destroy({ where: { id_pedidos: req.params.id }, transaction });
        await compra.destroy({ transaction });

        await transaction.commit();
        res.status(204).send();
    } catch (error) {
        await transaction.rollback();
        console.error('[Compras][deleteCompra] Error al eliminar compra:', error);
        res.status(500).json({ error: error.message });
    }
};

module.exports = {
    createCompra,
    getCompras,
    getComprasPendientes,
    getComprasFinalizadas,
    getCompraById,
    updateCompra,
    enviarCorreoProveedorPedido,
    deleteCompra
};
