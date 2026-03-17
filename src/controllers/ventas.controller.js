const initModels = require('../models/init-models');
const sequelize = require('../database');
const { Op } = require('sequelize');
const models = initModels(sequelize);

const includeConfig = [
    { model: models.estados, as: 'id_estado_estado' },
    {
        model: models.detalles_venta,
        as: 'detalles_venta',
        include: [
            { model: models.productos, as: 'producto' },
            {
                model: models.membresias,
                as: 'membresia',
                attributes: [
                    'id_membresias',
                    'nombre_membresia',
                    'descripcion_membresia',
                    'precio_de_venta',
                    'duracion_dias',
                    'id_estado'
                ],
                include: [
                    {
                        model: models.detalles_membresias,
                        as: 'detalles_membresia',
                        attributes: ['id_detalle_membresias', 'id_membresia', 'id_servicio', 'id_estado'],
                        required: false,
                        include: [
                            {
                                model: models.servicios,
                                as: 'id_servicio_servicio',
                                attributes: ['id_servicio', 'nombre_servicio', 'descripcion_servicio', 'precio_servicio']
                            }
                        ]
                    }
                ]
            },
            { model: models.servicios, as: 'servicio' }
        ]
    }
];

// Obtener la fecha actual del sistema como cadena YYYY-MM-DD para evitar desfases por zona horaria
const getLocalToday = () => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const formatDateOnly = (value) => {
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
            return trimmed;
        }
    }
    const d = value instanceof Date ? new Date(value) : new Date();
    if (Number.isNaN(d.getTime())) {
        return null;
    }
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
};

const pickFechaValue = (fechaNormalizada, dbToday) => {
    const today = new Date(dbToday);
    today.setHours(0, 0, 0, 0);

    if (!fechaNormalizada) {
        return sequelize.literal('CURRENT_DATE');
    }

    const parsed = new Date(fechaNormalizada);
    if (Number.isNaN(parsed.getTime())) {
        return sequelize.literal('CURRENT_DATE');
    }
    parsed.setHours(0, 0, 0, 0);

    // Si es hoy o futura respecto a la fecha de DB, usamos CURRENT_DATE para evitar timezone issues
    if (parsed >= today) {
        return sequelize.literal('CURRENT_DATE');
    }

    return fechaNormalizada;
};

const normalizeFechaVenta = (
    value,
    { allowDefaultToday = false, referenceDate = null, clampFutureToReference = false } = {}
) => {
    if (value === undefined || value === null || value === '') {
        if (!allowDefaultToday) return null;
        // Si no hay valor, usamos la fecha de referencia (db) o la local
        const ref = referenceDate instanceof Date ? referenceDate : new Date();
        return ref.toISOString().split('T')[0];
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        const err = new Error('fecha_venta no es valida');
        err.status = 400;
        throw err;
    }
    const today = referenceDate instanceof Date ? new Date(referenceDate) : new Date();
    parsed.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);
    if (parsed > today) {
        if (clampFutureToReference) {
            return today.toISOString().split('T')[0];
        }
        const err = new Error('fecha_venta no puede ser futura');
        err.status = 400;
        throw err;
    }
    return parsed.toISOString().split('T')[0];
};

const normalizePlazoMaximo = (value) => {
    if (value === undefined || value === null || value === '') {
        return null;
    }
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        const err = new Error('plazo_maximo no es valido');
        err.status = 400;
        throw err;
    }
    parsed.setHours(0, 0, 0, 0);
    return parsed.toISOString().split('T')[0];
};

const addDaysToDateOnly = (dateOnly, daysToAdd = 0) => {
    if (!dateOnly) return null;
    const [year, month, day] = String(dateOnly).split('-').map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }
    const base = new Date(year, month - 1, day);
    if (Number.isNaN(base.getTime())) {
        return null;
    }
    base.setDate(base.getDate() + Number(daysToAdd || 0));
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const computeSubtotal = ({ cantidad, valor_unitario }) => {
    const qty = Number(cantidad);
    const unit = Number(valor_unitario);
    if (!Number.isFinite(qty) || !Number.isFinite(unit)) return 0;
    return Number((qty * unit).toFixed(2));
};

const normalizeEstadoNombre = (estado) => {
    if (!estado) return null;
    if (typeof estado === 'string') return estado.toUpperCase();
    if (estado.estado) return String(estado.estado).toUpperCase();
    return null;
};

const MEMBERSHIP_STATE_ACTIVE_ID = 1;
const DEFAULT_MEMBERSHIP_DURATION_DAYS = Number(process.env.DEFAULT_MEMBERSHIP_DURATION_DAYS || 30);
const DEFAULT_VENTA_PENDIENTE_IDS = [3];
const DEFAULT_VENTA_FINAL_IDS = [5, 6];

const resolveBeneficiarioMembershipStateId = ({ estadoNombre } = {}) => {
    const normalized = normalizeEstadoNombre(estadoNombre);
    if (normalized === 'COMPLETADO') return MEMBERSHIP_STATE_ACTIVE_ID;
    return null;
};

const isEstadoCancelado = ({ estadoNombre, id_estado } = {}) => {
    const nombre = normalizeEstadoNombre(estadoNombre);
    if (nombre === 'CANCELADO') return true;
    const parsed = Number(id_estado);
    return Number.isFinite(parsed) && parsed === 6;
};

const isEstadoFinal = ({ estadoNombre, id_estado } = {}) => {
    const nombre = normalizeEstadoNombre(estadoNombre);
    if (nombre === 'COMPLETADO' || nombre === 'CANCELADO') return true;
    const parsed = Number(id_estado);
    return Number.isFinite(parsed) && (parsed === 5 || parsed === 6);
};

// Agrupa cantidades por producto para minimizar locks/updates
const aggregateProductQuantities = (detalles = []) => {
    const map = new Map();
    detalles.forEach((detalle) => {
        const id_producto = Number(detalle.id_producto);
        const cantidad = Number(detalle.cantidad);
        if (!Number.isInteger(id_producto) || id_producto <= 0) return;
        if (!Number.isFinite(cantidad) || cantidad <= 0) return;
        map.set(id_producto, (map.get(id_producto) || 0) + cantidad);
    });
    return map;
};

const buildStockError = (message) => {
    const error = new Error(message);
    error.status = 400;
    return error;
};

const buildRefError = (message) => {
    const error = new Error(message);
    error.status = 400;
    return error;
};

const normalizeDurationDays = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const resolveMembershipDurationDays = async ({ id_membresia, transaction, durationCache = null }) => {
    const membershipId = Number(id_membresia);
    if (!Number.isInteger(membershipId) || membershipId <= 0) {
        throw buildRefError(`Membresia invalida: ${id_membresia}`);
    }

    if (durationCache && durationCache.has(membershipId)) {
        return durationCache.get(membershipId);
    }

    const membership = await models.membresias.findByPk(membershipId, {
        attributes: ['id_membresias', 'duracion_dias'],
        transaction
    });

    if (!membership) {
        throw buildRefError(`Membresia no encontrada: ${membershipId}`);
    }

    const fallbackDuration = Number.isInteger(DEFAULT_MEMBERSHIP_DURATION_DAYS) && DEFAULT_MEMBERSHIP_DURATION_DAYS > 0
        ? DEFAULT_MEMBERSHIP_DURATION_DAYS
        : 30;
    const duration = normalizeDurationDays(membership.duracion_dias) ?? fallbackDuration;

    if (durationCache) {
        durationCache.set(membershipId, duration);
    }

    return duration;
};

const ensureEstadoExists = async (id_estado, transaction) => {
    if (id_estado === undefined || id_estado === null) return null;
    const estado = await models.estados.findByPk(id_estado, { transaction });
    if (!estado) {
        throw buildRefError(`Estado no encontrado: ${id_estado}`);
    }
    return estado;
};

const getEstadoNombreById = async (id_estado, transaction) => {
    const estado = await ensureEstadoExists(id_estado, transaction);
    return normalizeEstadoNombre(estado);
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

// Separa los detalles en colecciones por tipo para facilitar el mapeo en el front
const splitDetallesByTipo = (ventaInstance) => {
    if (!ventaInstance) return ventaInstance;
    const plain = typeof ventaInstance.toJSON === 'function' ? ventaInstance.toJSON() : ventaInstance;
    const productos = [];
    const membresias = [];
    (plain.detalles_venta || []).forEach((detalle) => {
        if (Number(detalle.id_producto)) productos.push(detalle);
        if (Number(detalle.id_membresia)) {
            const duracion = detalle?.membresia?.duracion_dias;
            const servicios = Array.isArray(detalle?.membresia?.detalles_membresia)
                ? detalle.membresia.detalles_membresia
                      .map((d) => d?.id_servicio_servicio)
                      .filter(Boolean)
                : [];
            // Clon simple para exponer duracion al nivel del detalle de membresia
            membresias.push({
                ...detalle,
                ...(duracion !== undefined ? { duracion_dias: duracion, duracion_membresia: duracion } : {}),
                servicios_membresia: servicios,
                servicios
            });
        }
    });
    return { ...plain, productos, membresias };
};

// Verifica que existan los ids referenciados en los detalles
const ensureVentaRefsExist = async ({ detalles = [], transaction }) => {
    if (!Array.isArray(detalles) || !detalles.length) return;

    const productIds = new Set();
    const membershipIds = new Set();
    const serviceIds = new Set();

    detalles.forEach((d) => {
        const p = Number(d.id_producto);
        if (Number.isInteger(p) && p > 0) productIds.add(p);
        const m = Number(d.id_membresia);
        if (Number.isInteger(m) && m > 0) membershipIds.add(m);
        const s = Number(d.id_servicio);
        if (Number.isInteger(s) && s > 0) serviceIds.add(s);
    });

    if (productIds.size) {
        const found = await models.productos.findAll({
            where: { id_productos: [...productIds] },
            attributes: ['id_productos'],
            transaction
        });
        const foundSet = new Set(found.map((p) => p.id_productos));
        const missing = [...productIds].filter((id) => !foundSet.has(id));
        if (missing.length) throw buildRefError(`Producto(s) no encontrados: ${missing.join(', ')}`);
    }

    if (membershipIds.size) {
        const found = await models.membresias.findAll({
            where: { id_membresias: [...membershipIds] },
            attributes: ['id_membresias'],
            transaction
        });
        const foundSet = new Set(found.map((m) => m.id_membresias));
        const missing = [...membershipIds].filter((id) => !foundSet.has(id));
        if (missing.length) throw buildRefError(`Membresia(s) no encontradas: ${missing.join(', ')}`);
    }

    if (serviceIds.size) {
        const found = await models.servicios.findAll({
            where: { id_servicio: [...serviceIds] },
            attributes: ['id_servicio'],
            transaction
        });
        const foundSet = new Set(found.map((s) => s.id_servicio));
        const missing = [...serviceIds].filter((id) => !foundSet.has(id));
        if (missing.length) throw buildRefError(`Servicio(s) no encontrados: ${missing.join(', ')}`);
    }
};

// Ajusta el stock de productos (decrementa o incrementa) dentro de la misma transaccion
// skipMissing: true para no fallar si algun producto ya no existe (ej. cancelacion de venta antigua)
const adjustStock = async ({ detalles = [], transaction, mode = 'decrement', skipMissing = false }) => {
    const quantities = aggregateProductQuantities(detalles);
    if (!quantities.size) return;

    const productIds = [...quantities.keys()];
    const products = await models.productos.findAll({
        where: { id_productos: productIds },
        transaction,
        lock: transaction.LOCK.UPDATE
    });

    const productsMap = new Map(products.map((p) => [p.id_productos, p]));
    if (!skipMissing && productsMap.size !== productIds.length) {
        const missing = productIds.filter((id) => !productsMap.has(id));
        throw buildStockError(`Producto(s) no encontrados: ${missing.join(', ')}`);
    }

    for (const [id_producto, qty] of quantities.entries()) {
        const product = productsMap.get(id_producto);
        if (!product) {
            if (skipMissing) continue;
            throw buildStockError(`Producto no encontrado: ${id_producto}`);
        }
        const currentStock = Number(product.stock);
        const newStock = mode === 'decrement' ? currentStock - qty : currentStock + qty;

        if (mode === 'decrement' && newStock < 0) {
            throw buildStockError(`Stock insuficiente para el producto '${product.nombre_producto}' (id ${id_producto})`);
        }

        product.stock = newStock;
        await product.save({ transaction });
    }
};

const normalizeDetalles = (detalles = [], id_pedido_cliente) =>
    detalles.map((detalle) => ({
        tipo_venta: detalle.tipo_venta,
        cantidad: detalle.cantidad,
        perdidas_o_ganancias: detalle.perdidas_o_ganancias,
        id_producto: detalle.id_producto ?? null,
        id_membresia: detalle.id_membresia ?? null,
        id_servicio: detalle.id_servicio ?? null,
        valor_unitario: detalle.valor_unitario ?? 0,
        subtotal: computeSubtotal({ cantidad: detalle.cantidad, valor_unitario: detalle.valor_unitario }),
        id_pedido_cliente,
        // Metadata (no se guarda en detalles_venta, pero se usa para poblar beneficiarios)
        __beneficiario: detalle.id_relacion ?? detalle.id_beneficiario ?? null,
        __estado_membresia: detalle.id_estado_membresia ?? detalle.id_estado ?? null
    }));

const resolveTotal = (valor_total_venta, detallesNormalizados = []) => {
    if (valor_total_venta !== undefined && valor_total_venta !== null) {
        return Number(valor_total_venta);
    }
    const sum = detallesNormalizados.reduce((acc, detalle) => acc + Number(detalle.subtotal), 0);
    return Number(sum.toFixed(2));
};

// Reemplaza cualquier membresia previa para el par (cliente, beneficiario)
// y deja un unico registro activo.
const replaceMembershipAssignment = async ({
    id_usuario,
    id_relacion,
    id_membresia,
    id_estado_membresia = MEMBERSHIP_STATE_ACTIVE_ID,
    transaction,
    durationCache = null
}) => {
    if (
        !Number.isInteger(id_usuario) ||
        !Number.isInteger(id_relacion) ||
        !Number.isInteger(id_membresia) ||
        !Number.isInteger(id_estado_membresia)
    ) {
        return;
    }

    await models.detalles_cliente_beneficiarios.destroy({
        where: { id_usuario, id_relacion },
        transaction
    });

    const fechaAsignacion = getLocalToday();
    const durationDays = await resolveMembershipDurationDays({
        id_membresia,
        transaction,
        durationCache
    });
    const fechaVencimiento = addDaysToDateOnly(fechaAsignacion, durationDays);

    await models.detalles_cliente_beneficiarios.create(
        {
            id_usuario,
            id_relacion,
            id_membresia,
            id_estado_membresia,
            fecha_asignacion: fechaAsignacion,
            fecha_vencimiento: fechaVencimiento
        },
        { transaction }
    );
};

const findLatestMembershipIdForOwner = async ({ id_usuario, transaction }) => {
    const ownerId = Number(id_usuario);
    if (!Number.isInteger(ownerId) || ownerId <= 0) return null;

    const active = await models.detalles_cliente_beneficiarios.findOne({
        where: {
            id_usuario: ownerId,
            id_relacion: ownerId,
            id_estado_membresia: MEMBERSHIP_STATE_ACTIVE_ID
        },
        order: [['id_beneficiario', 'DESC']],
        transaction
    });

    const membershipId = Number(active?.id_membresia);
    return Number.isInteger(membershipId) && membershipId > 0 ? membershipId : null;
};

const detachOwnerAsBeneficiaryFromOthers = async ({ ownerId, transaction }) => {
    await models.detalles_cliente_beneficiarios.destroy({
        where: {
            id_relacion: ownerId,
            id_usuario: { [Op.ne]: ownerId }
        },
        transaction
    });
};

// Pobla la tabla detalles_cliente_beneficiarios cuando se venden membresias
// y asegura solo una membresia activa por (id_usuario, id_relacion)
const syncBeneficiarios = async ({ id_usuario, detalles = [], transaction, membershipStateId }) => {
    const targetStateId = Number(membershipStateId);
    if (!Number.isInteger(targetStateId) || targetStateId <= 0) return;

    const ownerId = Number(id_usuario);
    if (!Number.isInteger(ownerId) || ownerId <= 0) return;

    const assignmentsByPair = new Map();

    detalles.forEach((detalle) => {
        const id_membresia = Number(detalle.id_membresia);
        // Solo procesamos si hay membresia valida (>0). Para productos/servicios se omite.
        if (!Number.isInteger(id_membresia) || id_membresia <= 0) return;

        const beneficiario =
            Number(detalle.__beneficiario) ||
            Number(detalle.id_relacion) ||
            Number(detalle.id_beneficiario) ||
            Number(id_usuario);

        if (!Number.isInteger(beneficiario) || beneficiario <= 0) return;

        // Si hay varias membresias para el mismo par en una misma venta,
        // conservamos solo la ultima.
        assignmentsByPair.set(`${ownerId}:${beneficiario}`, {
            id_usuario: ownerId,
            id_relacion: beneficiario,
            id_membresia
        });
    });

    const ownerSelfAssignment = assignmentsByPair.get(`${ownerId}:${ownerId}`);
    if (ownerSelfAssignment && targetStateId === MEMBERSHIP_STATE_ACTIVE_ID) {
        // Si compra membresia desde su propia cuenta, deja de ser beneficiario de otros titulares.
        await detachOwnerAsBeneficiaryFromOthers({ ownerId, transaction });
    }

    const ownerMembershipId =
        Number(ownerSelfAssignment?.id_membresia) || (await findLatestMembershipIdForOwner({ id_usuario: ownerId, transaction }));

    if (Number.isInteger(ownerMembershipId) && ownerMembershipId > 0) {
        // Regla de negocio: todos los beneficiarios del titular usan la misma membresia activa del titular.
        for (const [key, assignment] of assignmentsByPair.entries()) {
            if (assignment.id_relacion !== ownerId) {
                assignmentsByPair.set(key, {
                    ...assignment,
                    id_membresia: ownerMembershipId
                });
            }
        }

        // Si el titular actualizo su membresia, propagamos el reemplazo a beneficiarios ya existentes
        // aunque no vengan en los detalles de la venta.
        const existingBeneficiarios = await models.detalles_cliente_beneficiarios.findAll({
            where: {
                id_usuario: ownerId,
                id_relacion: { [Op.ne]: ownerId }
            },
            attributes: ['id_relacion'],
            transaction
        });

        existingBeneficiarios.forEach((row) => {
            const relationId = Number(row.id_relacion);
            if (!Number.isInteger(relationId) || relationId <= 0) return;
            assignmentsByPair.set(`${ownerId}:${relationId}`, {
                id_usuario: ownerId,
                id_relacion: relationId,
                id_membresia: ownerMembershipId
            });
        });
    }

    if (!assignmentsByPair.size) return;

    const durationCache = new Map();
    for (const entry of assignmentsByPair.values()) {
        await replaceMembershipAssignment({
            ...entry,
            id_estado_membresia: targetStateId,
            transaction,
            durationCache
        });
    }
};

const getVentas = async (_req, res) => {
    try {
        const ventas = await models.pedidos_clientes.findAll({
            include: includeConfig,
            order: [['fecha_venta', 'DESC']]
        });
        res.json(ventas.map(splitDetallesByTipo));
    } catch (error) {
        console.error('[Ventas][getVentas] error:', error);
        res.status(500).json({ message: 'Error al obtener las ventas', error: error.message });
    }
};

const getVentasPendientes = async (_req, res) => {
    try {
        const estadoIds = await resolveEstadoIds({
            nombres: ['PENDIENTE'],
            fallbackIds: DEFAULT_VENTA_PENDIENTE_IDS
        });
        const ventas = await models.pedidos_clientes.findAll({
            where: { id_estado: { [Op.in]: estadoIds } },
            include: includeConfig,
            order: [['fecha_venta', 'DESC']]
        });
        res.json(ventas.map(splitDetallesByTipo));
    } catch (error) {
        console.error('[Ventas][getVentasPendientes] error:', error);
        res.status(500).json({ message: 'Error al obtener las ventas pendientes', error: error.message });
    }
};

const getVentasFinalizadas = async (_req, res) => {
    try {
        const estadoIds = await resolveEstadoIds({
            nombres: ['COMPLETADO', 'CANCELADO', 'RECHAZADO'],
            fallbackIds: DEFAULT_VENTA_FINAL_IDS
        });
        const ventas = await models.pedidos_clientes.findAll({
            where: { id_estado: { [Op.in]: estadoIds } },
            include: includeConfig,
            order: [['fecha_venta', 'DESC']]
        });
        res.json(ventas.map(splitDetallesByTipo));
    } catch (error) {
        console.error('[Ventas][getVentasFinalizadas] error:', error);
        res.status(500).json({ message: 'Error al obtener las ventas finalizadas', error: error.message });
    }
};

const getVentasByUsuario = async (req, res) => {
    const rawId = req.params.id_usuario;
    const id_usuario = Number(rawId);
    if (!Number.isInteger(id_usuario) || id_usuario <= 0) {
        return res.status(400).json({ message: '"id_usuario" debe ser un entero positivo' });
    }

    const requesterId = Number(req.user?.id);
    if (!Number.isInteger(requesterId) || requesterId <= 0) {
        return res.status(401).json({ message: 'No autenticado' });
    }
    if (requesterId !== id_usuario) {
        return res.status(403).json({ message: 'No puede acceder a ventas de otro usuario' });
    }

    try {
        const ventas = await models.pedidos_clientes.findAll({
            where: { id_usuario },
            include: includeConfig,
            order: [['fecha_venta', 'DESC']]
        });
        res.json(ventas.map(splitDetallesByTipo));
    } catch (error) {
        console.error('[Ventas][getVentasByUsuario] error:', error);
        res.status(500).json({ message: 'Error al obtener las ventas del usuario', error: error.message });
    }
};

const getVentasAutenticado = async (req, res) => {
    const requesterId = Number(req.user?.id);
    if (!Number.isInteger(requesterId) || requesterId <= 0) {
        return res.status(401).json({ message: 'No autenticado' });
    }
    try {
        const ventas = await models.pedidos_clientes.findAll({
            where: { id_usuario: requesterId },
            include: includeConfig,
            order: [['fecha_venta', 'DESC']]
        });
        res.json(ventas.map(splitDetallesByTipo));
    } catch (error) {
        console.error('[Ventas][getVentasAutenticado] error:', error);
        res.status(500).json({ message: 'Error al obtener tus ventas', error: error.message });
    }
};

const getVentaById = async (req, res) => {
    try {
        const venta = await models.pedidos_clientes.findByPk(req.params.id, { include: includeConfig });
        if (!venta) {
            return res.status(404).json({ message: 'Venta no encontrada' });
        }
        res.json(splitDetallesByTipo(venta));
    } catch (error) {
        console.error('[Ventas][getVentaById] error:', error);
        res.status(500).json({ message: 'Error al obtener la venta', error: error.message });
    }
};

const createVenta = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const {
            id_usuario,
            fecha_venta,
            id_estado,
            valor_total_venta,
            detalles
        } = req.body;

        const estadoId = id_estado ?? 3; // PENDIENTE por defecto
        const estadoNombre = await getEstadoNombreById(estadoId, transaction);

        const detallesNormalizados = normalizeDetalles(detalles || [], null);

        const total = resolveTotal(valor_total_venta, detallesNormalizados);

        // Usamos la fecha del sistema en formato DATEONLY (string) para evitar desplazamientos de zona horaria
        const fechaValor = getLocalToday();
        const plazoMaximoValue = addDaysToDateOnly(fechaValor, 3);

        const pedido = await models.pedidos_clientes.create(
            {
                id_usuario,
                valor_total_venta: total,
                fecha_venta: fechaValor,
                plazo_maximo: plazoMaximoValue,
                id_estado: estadoId
            },
            { transaction }
        );

        const detallesConPedido = normalizeDetalles(detalles || [], pedido.id_pedido_cliente);

        await ensureVentaRefsExist({ detalles: detallesConPedido, transaction });

        // Descuenta stock de productos vendidos
        await adjustStock({ detalles: detallesConPedido, transaction, mode: 'decrement' });

        await models.detalles_venta.bulkCreate(detallesConPedido, { transaction });
        const membershipStateId = resolveBeneficiarioMembershipStateId({ estadoNombre });
        if (membershipStateId) {
            await syncBeneficiarios({
                id_usuario,
                detalles: detallesConPedido,
                transaction,
                membershipStateId
            });
        }
        await transaction.commit();

        const ventaCreada = await models.pedidos_clientes.findByPk(pedido.id_pedido_cliente, { include: includeConfig });
        res.status(201).json({ message: 'Venta creada exitosamente', venta: ventaCreada });
    } catch (error) {
        await transaction.rollback();
        console.error('[Ventas][createVenta] error:', error);
        const statusCode = error.status || 500;
        const clientMessage = statusCode >= 500 ? 'Error al crear la venta' : (error.message || 'Error al crear la venta');
        res.status(statusCode).json({ message: clientMessage, error: error.message });
    }
};

const updateVenta = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const venta = await models.pedidos_clientes.findByPk(req.params.id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!venta) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const {
            id_usuario,
            fecha_venta,
            id_estado,
            valor_total_venta,
            plazo_maximo,
            plazoMaximo,
            detalles
        } = req.body;

        const estadoNombreActual = await getEstadoNombreById(venta.id_estado, transaction);
        const esEstadoActualFinal = isEstadoFinal({ estadoNombre: estadoNombreActual, id_estado: venta.id_estado });
        const esEstadoActualCancelado = isEstadoCancelado({
            estadoNombre: estadoNombreActual,
            id_estado: venta.id_estado
        });

        const updates = {};
        if (id_usuario !== undefined) updates.id_usuario = id_usuario;
        const hasPlazoMaximoPayload =
            Object.prototype.hasOwnProperty.call(req.body, 'plazo_maximo') ||
            Object.prototype.hasOwnProperty.call(req.body, 'plazoMaximo');
        if (hasPlazoMaximoPayload) {
            updates.plazo_maximo = normalizePlazoMaximo(plazo_maximo ?? plazoMaximo);
        }
        let estadoNombreNuevo = null;
        if (id_estado !== undefined) {
            if (esEstadoActualFinal && Number(id_estado) !== venta.id_estado) {
                await transaction.rollback();
                return res
                    .status(400)
                    .json({ message: 'No se puede modificar el estado de una venta completada o cancelada' });
            }
            const estadoRow = await ensureEstadoExists(id_estado, transaction);
            estadoNombreNuevo = normalizeEstadoNombre(estadoRow);
            updates.id_estado = id_estado;
        }
        // Siempre fijamos la fecha a la del sistema al momento de la actualizacion
        updates.fecha_venta = getLocalToday();
        let detallesNormalizados;
        let detallesPrevios = [];
        let estadoFinalNombre;
        const estadoNombreEvaluado = estadoNombreNuevo ?? estadoNombreActual;
        const estadoFinalId = updates.id_estado ?? venta.id_estado;
        if (estadoNombreEvaluado && estadoNombreEvaluado !== estadoNombreActual) {
            console.log(
                `[Ventas][update] venta ${venta.id_pedido_cliente} estado ${estadoNombreActual || 'DESCONOCIDO'} -> ${estadoNombreEvaluado} (id ${estadoFinalId}) by user ${
                    req.user?.id ?? 'n/a'
                }`
            );
        }
        const cancelRequest = isEstadoCancelado({
            estadoNombre: estadoNombreEvaluado,
            id_estado: estadoFinalId
        });
        if (Array.isArray(detalles)) {
            detallesNormalizados = normalizeDetalles(detalles, venta.id_pedido_cliente);
            updates.valor_total_venta = resolveTotal(valor_total_venta, detallesNormalizados);
            await ensureVentaRefsExist({ detalles: detallesNormalizados, transaction });
            detallesPrevios = await models.detalles_venta.findAll({
                where: { id_pedido_cliente: venta.id_pedido_cliente },
                transaction,
                lock: transaction.LOCK.UPDATE
            });
        } else if (valor_total_venta !== undefined) {
            updates.valor_total_venta = Number(valor_total_venta);
        }
        estadoFinalNombre = estadoNombreEvaluado;

        if (
            !cancelRequest &&
            Object.keys(updates).length === 0 &&
            !Array.isArray(detalles) &&
            valor_total_venta === undefined
        ) {
            await transaction.rollback();
            return res.status(400).json({ message: 'No hay cambios para aplicar' });
        }

        if (!cancelRequest && Object.keys(updates).length > 0) {
            await venta.update(updates, { transaction });
        }

        if (cancelRequest) {
            const esTransicionACancelado = !esEstadoActualCancelado;
            if (esTransicionACancelado) {
                const detallesAReponer = detallesPrevios.length
                    ? detallesPrevios
                    : await models.detalles_venta.findAll({
                          where: { id_pedido_cliente: venta.id_pedido_cliente },
                          transaction,
                          lock: transaction.LOCK.UPDATE
                      });

                if (detallesAReponer.length) {
                    await adjustStock({
                        detalles: detallesAReponer,
                        transaction,
                        mode: 'increment',
                        skipMissing: true
                    });
                }
            }

            await venta.update(
                {
                    ...updates,
                    id_estado: updates.id_estado ?? venta.id_estado
                },
                { transaction }
            );
        } else if (Array.isArray(detalles) && detallesNormalizados) {
            // Primero regresamos stock de los detalles anteriores
            if (detallesPrevios.length) {
                await adjustStock({ detalles: detallesPrevios, transaction, mode: 'increment' });
            }

            await models.detalles_venta.destroy({
                where: { id_pedido_cliente: venta.id_pedido_cliente },
                transaction
            });

            // Descontamos stock por los nuevos detalles 
            await adjustStock({ detalles: detallesNormalizados, transaction, mode: 'decrement' }); 

            await models.detalles_venta.bulkCreate(detallesNormalizados, { transaction }); 
            const membershipStateId = resolveBeneficiarioMembershipStateId({ estadoNombre: estadoFinalNombre });
            if (membershipStateId) { 
                await syncBeneficiarios({ 
                    id_usuario: updates.id_usuario ?? venta.id_usuario, 
                    detalles: detallesNormalizados, 
                    transaction, 
                    membershipStateId
                }); 
            } 
        } else if ( 
            !Array.isArray(detalles) && 
            resolveBeneficiarioMembershipStateId({ estadoNombre: estadoFinalNombre }) && 
            updates.id_estado
        ) {
            // Cambio de estado a PENDIENTE/COMPLETADO, sincronizamos beneficiarios con los detalles existentes
            const detallesExistentes = await models.detalles_venta.findAll({
                where: { id_pedido_cliente: venta.id_pedido_cliente },
                transaction
            });
            if (detallesExistentes.length) { 
                const membershipStateId = resolveBeneficiarioMembershipStateId({ estadoNombre: estadoFinalNombre });
                await syncBeneficiarios({ 
                    id_usuario: updates.id_usuario ?? venta.id_usuario, 
                    detalles: detallesExistentes, 
                    transaction, 
                    membershipStateId
                }); 
            } 
        } 

        await transaction.commit();
        const ventaActualizada = await models.pedidos_clientes.findByPk(venta.id_pedido_cliente, { include: includeConfig });
        res.json({ message: 'Venta actualizada correctamente', venta: ventaActualizada });
    } catch (error) {
        await transaction.rollback();
        console.error('[Ventas][updateVenta] error:', error);
        res.status(error.status || 500).json({ message: 'Error al actualizar la venta', error: error.message });
    }
};

const deleteVenta = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const venta = await models.pedidos_clientes.findByPk(req.params.id, {
            transaction,
            lock: transaction.LOCK.UPDATE
        });
        if (!venta) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Venta no encontrada' });
        }

        const detallesPrevios = await models.detalles_venta.findAll({
            where: { id_pedido_cliente: venta.id_pedido_cliente },
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        if (detallesPrevios.length) {
            await adjustStock({ detalles: detallesPrevios, transaction, mode: 'increment' });
        }

        await models.detalles_venta.destroy({
            where: { id_pedido_cliente: venta.id_pedido_cliente },
            transaction
        });
        await venta.destroy({ transaction });
        await transaction.commit();

        res.json({ message: 'Venta eliminada correctamente' });
    } catch (error) {
        await transaction.rollback();
        console.error('[Ventas][deleteVenta] error:', error);
        res.status(error.status || 500).json({ message: 'Error al eliminar la venta', error: error.message });
    }
};

module.exports = {
    getVentas,
    getVentasPendientes,
    getVentasFinalizadas,
    getVentasByUsuario,
    getVentasAutenticado,
    getVentaById,
    createVenta,
    updateVenta,
    deleteVenta
};
