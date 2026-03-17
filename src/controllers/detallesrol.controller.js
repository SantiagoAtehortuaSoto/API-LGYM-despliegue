const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const DETALLES_ROL_INCLUDE = [
    { model: models.rol, as: 'id_rol_rol', attributes: ['id_rol', 'nombre', 'id_estado'] },
    {
        model: models.permisos,
        as: 'id_permiso_permiso',
        attributes: ['id_permiso', 'nombre', 'id_estado']
    },
    {
        model: models.privilegios,
        as: 'id_privilegio_privilegio',
        attributes: ['id_privilegio', 'nombre']
    }
];

const buildDetallesRolWhere = (filters = {}) => {
    const where = {};
    if (filters.id_rol !== undefined) where.id_rol = filters.id_rol;
    if (filters.id_permiso !== undefined) where.id_permiso = filters.id_permiso;
    if (filters.id_privilegio !== undefined) where.id_privilegio = filters.id_privilegio;
    return where;
};

const getDetallesRol = async (req, res) => {
    try {
        const where = buildDetallesRolWhere(req.detallesRolFilters);
        const detalles = await models.detallesrol.findAll({
            include: DETALLES_ROL_INCLUDE,
            ...(Object.keys(where).length ? { where } : {}),
            ...(req.detallesRolLimit !== undefined ? { limit: req.detallesRolLimit } : {}),
            ...(req.detallesRolOffset !== undefined ? { offset: req.detallesRolOffset } : {})
        });

        return res.status(200).json(detalles);
    } catch (error) {
        console.error('[DetallesRol][getDetallesRol]', error);
        return res.status(500).json({ message: 'Error al obtener los detalles de rol' });
    }
};

module.exports = { getDetallesRol };
