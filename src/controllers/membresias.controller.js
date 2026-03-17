const initModels = require('../models/init-models');
const sequelize = require('../database');
const { Op } = require('sequelize');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const MEMBRESIA_INCLUDE = [
    {
        model: models.detalles_membresias,
        as: 'detalles_membresia',
        include: [
            {
                model: models.servicios,
                as: 'id_servicio_servicio'
            }
        ]
    },
    {
        model: models.estados,
        as: 'id_estado_estado',
        attributes: ['estado']
    }
];

const extractPossibleServicioId = (item) => {
    if (item === undefined || item === null) return null;
    if (typeof item === 'number' || typeof item === 'bigint') return Number(item);

    if (typeof item === 'string') {
        const trimmed = item.trim();
        if (!trimmed) return null;
        return Number(trimmed);
    }

    if (typeof item === 'object') {
        return (
            item.id_servicio ??
            item.idServicio ??
            item.servicioId ??
            item.servicio_id ??
            item.id ??
            item.value ??
            item?.servicio?.id_servicio ??
            item?.servicio?.id ??
            null
        );
    }

    return null;
};

const normalizeBeneficiosInput = (rawBeneficios) => {
    if (rawBeneficios === undefined || rawBeneficios === null) {
        return [];
    }

    let beneficios = rawBeneficios;

    if (typeof rawBeneficios === 'string') {
        const trimmed = rawBeneficios.trim();
        if (!trimmed) return [];
        try {
            beneficios = JSON.parse(trimmed);
        } catch (_error) {
            beneficios = trimmed
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
        }
    }

    if (typeof beneficios === 'number' || typeof beneficios === 'bigint') {
        beneficios = [Number(beneficios)];
    }

    if (!Array.isArray(beneficios)) return [];

    const normalized = [];
    const seen = new Set();

    for (const raw of beneficios) {
        const parsed = Number(extractPossibleServicioId(raw));
        if (!Number.isInteger(parsed) || parsed <= 0 || seen.has(parsed)) continue;
        seen.add(parsed);
        normalized.push(parsed);
    }

    return normalized;
};

const ensureServiciosExisten = async (servicioIds, transaction) => {
    if (!servicioIds.length) return;

    const serviciosEncontrados = await models.servicios.findAll({
        where: { id_servicio: { [Op.in]: servicioIds } },
        attributes: ['id_servicio'],
        transaction
    });

    if (serviciosEncontrados.length !== servicioIds.length) {
        const encontrados = new Set(serviciosEncontrados.map((svc) => svc.id_servicio));
        const faltantes = servicioIds.filter((id) => !encontrados.has(id));
        const error = new Error(`Los siguientes servicios no existen: ${faltantes.join(', ')}`);
        error.statusCode = 400;
        throw error;
    }
};

const buildDetallesPayload = (servicioIds, membresiaId, estadoId) =>
    servicioIds.map((servicioId) => ({
        id_membresia: membresiaId,
        id_servicio: servicioId,
        id_estado: estadoId
    }));

const sanitizeMembresiaPayload = (body = {}, estadoIdResolved = undefined) => {
    const payload = {};
    if (body.nombre !== undefined) payload.nombre_membresia = body.nombre;
    if (body.descripcion !== undefined) payload.descripcion_membresia = body.descripcion;
    if (body.precioVenta !== undefined) payload.precio_de_venta = body.precioVenta;
    if (body.duracion_dias !== undefined) payload.duracion_dias = body.duracion_dias;
    if (estadoIdResolved !== undefined) payload.id_estado = estadoIdResolved;
    return payload;
};

const handleMembresiaError = (res, method, error, fallbackMessage) => {
    console.error(`[Membresias][${method}]`, error);
    const status = error.statusCode || 500;
    if (status >= 500) {
        return res.status(500).json({ message: fallbackMessage });
    }
    return res.status(status).json({ message: error.message || fallbackMessage });
};

const findAll = async (req, res) => {
    try {
        const membresias = await paginateModel(models.membresias, req, {
            additionalSearchFields: [
                'id_estado_estado.estado',
                'detalles_membresia.id_servicio_servicio.nombre_servicio',
                'detalles_membresia.id_servicio_servicio.descripcion_servicio',
                'detalles_membresia.id_servicio_servicio.tipo_servicio'
            ],
            include: MEMBRESIA_INCLUDE,
            order: [['id_membresias', 'ASC']]
        });
        return res.status(200).json(membresias);
    } catch (error) {
        return handleMembresiaError(
            res,
            'findAll',
            error,
            'Error al obtener membresias'
        );
    }
};

const findOne = async (req, res) => {
    try {
        const membresiaId = req.membresia?.id_membresias || req.params.id;
        const membresia = await models.membresias.findByPk(membresiaId, {
            include: MEMBRESIA_INCLUDE
        });
        if (!membresia) {
            return res.status(404).json({ message: 'Membresia no encontrada' });
        }
        return res.status(200).json(membresia);
    } catch (error) {
        return handleMembresiaError(
            res,
            'findOne',
            error,
            'Error al obtener membresia'
        );
    }
};

const create = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const payload = sanitizeMembresiaPayload(req.body, req.membresiaEstadoId);
        const nuevaMembresia = await models.membresias.create(payload, { transaction });

        const beneficioIds = normalizeBeneficiosInput(req.body.beneficios);
        if (beneficioIds.length) {
            await ensureServiciosExisten(beneficioIds, transaction);
            const detallesPayload = buildDetallesPayload(
                beneficioIds,
                nuevaMembresia.id_membresias,
                nuevaMembresia.id_estado
            );
            await models.detalles_membresias.bulkCreate(detallesPayload, { transaction });
        }

        await transaction.commit();

        const membresiaConRelaciones = await models.membresias.findByPk(
            nuevaMembresia.id_membresias,
            { include: MEMBRESIA_INCLUDE }
        );
        return res.status(201).json(membresiaConRelaciones || nuevaMembresia);
    } catch (error) {
        await transaction.rollback();
        return handleMembresiaError(
            res,
            'create',
            error,
            'Error al crear membresia'
        );
    }
};

const update = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const membresia = req.membresia || (await models.membresias.findByPk(req.params.id, { transaction }));
        if (!membresia) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Membresia no encontrada' });
        }

        const payload = sanitizeMembresiaPayload(req.body, req.membresiaEstadoId);
        if (Object.keys(payload).length) {
            await membresia.update(payload, { transaction });
        }

        if (req.body.beneficios !== undefined) {
            const beneficioIds = normalizeBeneficiosInput(req.body.beneficios);
            await models.detalles_membresias.destroy({
                where: { id_membresia: membresia.id_membresias },
                transaction
            });

            if (beneficioIds.length) {
                await ensureServiciosExisten(beneficioIds, transaction);
                const estadoDetalles = payload.id_estado ?? membresia.id_estado;
                const detallesPayload = buildDetallesPayload(
                    beneficioIds,
                    membresia.id_membresias,
                    estadoDetalles
                );
                await models.detalles_membresias.bulkCreate(detallesPayload, { transaction });
            }
        }

        await transaction.commit();

        const updatedMembresia = await models.membresias.findByPk(membresia.id_membresias, {
            include: MEMBRESIA_INCLUDE
        });
        return res.status(200).json(updatedMembresia || membresia);
    } catch (error) {
        await transaction.rollback();
        return handleMembresiaError(
            res,
            'update',
            error,
            'Error al actualizar membresia'
        );
    }
};

const remove = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const membresia = req.membresia || (await models.membresias.findByPk(req.params.id, { transaction }));
        if (!membresia) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Membresia no encontrada' });
        }

        const membresiaId = membresia.id_membresias;

        const ventasUsandoMembresia = await models.detalles_venta.count({
            where: { id_membresia: membresiaId },
            transaction
        });
        if (ventasUsandoMembresia > 0) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'No se puede eliminar la membresia porque existe en ventas.'
            });
        }

        const beneficiariosUsandoMembresia = await models.detalles_cliente_beneficiarios.count({
            where: { id_membresia: membresiaId },
            transaction
        });
        if (beneficiariosUsandoMembresia > 0) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'No se puede eliminar la membresia porque esta asociada a beneficiarios.'
            });
        }

        await models.detalles_membresias.destroy({
            where: { id_membresia: membresiaId },
            transaction
        });

        await membresia.destroy({ transaction });
        await transaction.commit();

        return res.status(200).json({ message: 'Membresia eliminada exitosamente' });
    } catch (error) {
        await transaction.rollback();
        return handleMembresiaError(
            res,
            'remove',
            error,
            'Error al eliminar membresia'
        );
    }
};

module.exports = {
    findAll,
    findOne,
    create,
    update,
    remove
};
