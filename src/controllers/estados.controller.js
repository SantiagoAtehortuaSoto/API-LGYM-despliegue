const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const sanitizeEstadoPayload = (body = {}) => {
    const payload = {};
    if (body.estado !== undefined) payload.estado = body.estado;
    if (body.descripcion !== undefined) payload.descripcion = body.descripcion;
    return payload;
};

const handleEstadoError = (res, method, error, message) => {
    console.error(`[Estados][${method}]`, error);
    return res.status(500).json({ message });
};

const getEstados = async (req, res) => {
    try {
        const estados = await paginateModel(models.estados, req, {
            order: [['id_estado', 'ASC']]
        });
        return res.status(200).json(estados);
    } catch (error) {
        return handleEstadoError(
            res,
            'getEstados',
            error,
            'Error al obtener estados'
        );
    }
};

const getEstadoById = (req, res) => {
    return res.status(200).json(req.estado);
};

const createEstado = async (req, res) => {
    try {
        const payload = sanitizeEstadoPayload(req.body);
        const newEstado = await models.estados.create(payload);
        return res.status(201).json(newEstado);
    } catch (error) {
        return handleEstadoError(
            res,
            'createEstado',
            error,
            'Error al crear estado'
        );
    }
};

const updateEstado = async (req, res) => {
    try {
        const payload = sanitizeEstadoPayload(req.body);
        await req.estado.update(payload);
        return res.status(200).json(req.estado);
    } catch (error) {
        return handleEstadoError(
            res,
            'updateEstado',
            error,
            'Error al actualizar estado'
        );
    }
};

const deleteEstado = async (req, res) => {
    try {
        await req.estado.destroy();
        return res.status(200).json({ message: 'Estado eliminado' });
    } catch (error) {
        return handleEstadoError(
            res,
            'deleteEstado',
            error,
            'Error al eliminar estado'
        );
    }
};

module.exports = {
    getEstados,
    getEstadoById,
    createEstado,
    updateEstado,
    deleteEstado
};
