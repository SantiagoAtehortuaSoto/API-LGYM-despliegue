const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const sanitizePermisoPayload = (body = {}) => {
    const payload = {};
    if (body.nombre !== undefined) payload.nombre = body.nombre;
    if (body.id_estado !== undefined) payload.id_estado = body.id_estado;
    return payload;
};

const handlePermisoError = (res, method, error, fallbackMessage) => {
    console.error(`[Permisos][${method}]`, error);
    if (error?.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: 'Ya existe un permiso con ese nombre' });
    }
    return res.status(500).json({ message: fallbackMessage });
};

const buildPermisosGroupedResponse = (permisos, privilegios) =>
    permisos.map((permiso) => ({
        id_permiso: permiso.id_permiso,
        modulo: permiso.nombre,
        acciones: privilegios.map((privilegio) => ({
            id_permiso: permiso.id_permiso,
            id_privilegio: privilegio.id_privilegio,
            privilegio: privilegio.nombre
        }))
    }));

const getPermisos = async (req, res) => {
    try {
        const permisos = await paginateModel(models.permisos, req, {
            order: [['id_permiso', 'ASC']]
        });

        if (!req.groupByModulo) {
            return res.status(200).json(permisos);
        }

        const privilegios = await models.privilegios.findAll({
            attributes: ['id_privilegio', 'nombre'],
            order: [['id_privilegio', 'ASC']]
        });
        return res.status(200).json({
            ...permisos,
            data: buildPermisosGroupedResponse(permisos.data, privilegios)
        });
    } catch (error) {
        return handlePermisoError(
            res,
            'getPermisos',
            error,
            'Error al obtener permisos'
        );
    }
};

const getPermisoById = (req, res) => {
    return res.status(200).json(req.permiso);
};

const createPermiso = async (req, res) => {
    try {
        const payload = sanitizePermisoPayload(req.body);
        const newPermiso = await models.permisos.create(payload);
        return res.status(201).json(newPermiso);
    } catch (error) {
        return handlePermisoError(
            res,
            'createPermiso',
            error,
            'Error al crear permiso'
        );
    }
};

const updatePermiso = async (req, res) => {
    try {
        const payload = sanitizePermisoPayload(req.body);
        await req.permiso.update(payload);
        return res.status(200).json(req.permiso);
    } catch (error) {
        return handlePermisoError(
            res,
            'updatePermiso',
            error,
            'Error al actualizar permiso'
        );
    }
};

const deletePermiso = async (req, res) => {
    try {
        await req.permiso.destroy();
        return res.status(200).json({ message: 'Permiso eliminado' });
    } catch (error) {
        return handlePermisoError(
            res,
            'deletePermiso',
            error,
            'Error al eliminar permiso'
        );
    }
};

module.exports = {
    getPermisos,
    getPermisoById,
    createPermiso,
    updatePermiso,
    deletePermiso
};
