const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const DETALLE_MEMBRESIA_INCLUDE = [
    { model: models.membresias, as: 'id_membresia_membresia' },
    { model: models.servicios, as: 'id_servicio_servicio' },
    { model: models.estados, as: 'id_estado_estado' }
];

const configuredInactiveStateId = Number.parseInt(
    process.env.DETALLE_MEMBRESIA_INACTIVE_STATE_ID || '2',
    10
);
const INACTIVE_STATE_ID =
    Number.isInteger(configuredInactiveStateId) && configuredInactiveStateId > 0
        ? configuredInactiveStateId
        : 2;

const sanitizeDetallePayload = (body = {}) => {
    const payload = {};
    if (body.id_membresia !== undefined) payload.id_membresia = body.id_membresia;
    if (body.id_servicio !== undefined) payload.id_servicio = body.id_servicio;
    if (body.id_estado !== undefined) payload.id_estado = body.id_estado;
    return payload;
};

const handleDetalleMembresiaError = (res, method, error, message) => {
    console.error(`[DetallesMembresias][${method}]`, error);
    return res.status(500).json({ message });
};

const findAll = async (_req, res) => {
    try {
        const detalles = await models.detalles_membresias.findAll({
            include: DETALLE_MEMBRESIA_INCLUDE
        });
        return res.status(200).json(detalles);
    } catch (error) {
        return handleDetalleMembresiaError(
            res,
            'findAll',
            error,
            'Error al obtener detalles de membresias'
        );
    }
};

const findOne = (req, res) => {
    return res.status(200).json(req.detalleMembresia);
};

const create = async (req, res) => {
    try {
        const payload = sanitizeDetallePayload(req.body);
        const nuevoDetalle = await models.detalles_membresias.create(payload);
        return res.status(201).json(nuevoDetalle);
    } catch (error) {
        return handleDetalleMembresiaError(
            res,
            'create',
            error,
            'Error al crear detalle de membresia'
        );
    }
};

const update = async (req, res) => {
    try {
        const payload = sanitizeDetallePayload(req.body);
        await req.detalleMembresia.update(payload);
        return res.status(200).json(req.detalleMembresia);
    } catch (error) {
        return handleDetalleMembresiaError(
            res,
            'update',
            error,
            'Error al actualizar detalle de membresia'
        );
    }
};

const remove = async (req, res) => {
    try {
        await req.detalleMembresia.update({ id_estado: INACTIVE_STATE_ID });
        return res.status(200).json({
            message: 'Detalle de membresia desactivado exitosamente'
        });
    } catch (error) {
        return handleDetalleMembresiaError(
            res,
            'remove',
            error,
            'Error al desactivar detalle de membresia'
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
