const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const sanitizePrivilegioPayload = (body = {}) => {
    const payload = {};
    if (body.nombre !== undefined) payload.nombre = body.nombre;
    if (body.id_estado !== undefined) payload.id_estado = body.id_estado;
    return payload;
};

const handlePrivilegioError = (res, method, error, fallbackMessage) => {
    console.error(`[Privilegios][${method}]`, error);
    if (error?.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: 'Ya existe un privilegio con ese nombre' });
    }
    return res.status(500).json({ message: fallbackMessage });
};

const getPrivilegios = async (req, res) => {
    try {
        const privilegios = await paginateModel(models.privilegios, req, {
            order: [['id_privilegio', 'ASC']]
        });
        return res.status(200).json(privilegios);
    } catch (error) {
        return handlePrivilegioError(
            res,
            'getPrivilegios',
            error,
            'Error al obtener privilegios'
        );
    }
};

const getPrivilegioById = (req, res) => {
    return res.status(200).json(req.privilegio);
};

const createPrivilegio = async (req, res) => {
    try {
        const payload = sanitizePrivilegioPayload(req.body);
        const newPrivilegio = await models.privilegios.create(payload);
        return res.status(201).json(newPrivilegio);
    } catch (error) {
        return handlePrivilegioError(
            res,
            'createPrivilegio',
            error,
            'Error al crear privilegio'
        );
    }
};

const updatePrivilegio = async (req, res) => {
    try {
        const payload = sanitizePrivilegioPayload(req.body);
        await req.privilegio.update(payload);
        return res.status(200).json(req.privilegio);
    } catch (error) {
        return handlePrivilegioError(
            res,
            'updatePrivilegio',
            error,
            'Error al actualizar privilegio'
        );
    }
};

const deletePrivilegio = async (req, res) => {
    try {
        await req.privilegio.destroy();
        return res.status(200).json({ message: 'Privilegio eliminado' });
    } catch (error) {
        return handlePrivilegioError(
            res,
            'deletePrivilegio',
            error,
            'Error al eliminar privilegio'
        );
    }
};

module.exports = {
    getPrivilegios,
    getPrivilegioById,
    createPrivilegio,
    updatePrivilegio,
    deletePrivilegio
};
