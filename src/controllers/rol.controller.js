const initModels = require('../models/init-models');
const sequelize = require('../database');
const { Op } = require('sequelize');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const PROTECTED_ROLE_IDS = new Set(
    String(process.env.PROTECTED_ROLE_IDS || '32,33')
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value !== '')
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
);

const ROLE_INCLUDE_CONFIG = [
    {
        model: models.detallesrol,
        as: 'detallesrols',
        include: [
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
        ]
    }
];

const handleRoleError = (res, method, error, fallbackMessage) => {
    console.error(`[Roles][${method}]`, error);
    if (error?.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({ message: 'Ya existe un rol con ese nombre' });
    }
    return res.status(500).json({ message: fallbackMessage });
};

const validatePermisosYPrivilegios = async (combos, transaction) => {
    if (!combos || combos.length === 0) {
        return { valid: true };
    }

    const permisoIds = [...new Set(combos.map((item) => item.id_permiso))];
    const privilegioIds = [...new Set(combos.map((item) => item.id_privilegio))];

    if (permisoIds.length > 0) {
        const permisos = await models.permisos.findAll({
            where: { id_permiso: { [Op.in]: permisoIds } },
            attributes: ['id_permiso'],
            transaction
        });
        if (permisos.length !== permisoIds.length) {
            return { valid: false, message: 'Uno o mas permisos no son validos' };
        }
    }

    if (privilegioIds.length > 0) {
        const privilegios = await models.privilegios.findAll({
            where: { id_privilegio: { [Op.in]: privilegioIds } },
            attributes: ['id_privilegio'],
            transaction
        });
        if (privilegios.length !== privilegioIds.length) {
            return { valid: false, message: 'Uno o mas privilegios no son validos' };
        }
    }

    return { valid: true };
};

const replaceRolePermissions = async ({ roleId, normalizedPermisos, transaction }) => {
    await models.detallesrol.destroy({
        where: { id_rol: roleId },
        transaction
    });

    if (!normalizedPermisos || normalizedPermisos.length === 0) {
        return;
    }

    const detallesRolData = normalizedPermisos.map((combo) => ({
        id_rol: roleId,
        id_permiso: combo.id_permiso,
        id_privilegio: combo.id_privilegio
    }));
    await models.detallesrol.bulkCreate(detallesRolData, { transaction });
};

const getRoles = async (req, res) => {
    try {
        const roles = await paginateModel(models.rol, req, {
            include: ROLE_INCLUDE_CONFIG,
            order: [['id_rol', 'ASC']]
        });
        return res.status(200).json(roles);
    } catch (error) {
        return handleRoleError(res, 'getRoles', error, 'Error al obtener roles');
    }
};

const getRolById = async (req, res) => {
    try {
        const roleId = req.rol?.id_rol || req.params.id;
        const rol = await models.rol.findByPk(roleId, {
            include: ROLE_INCLUDE_CONFIG
        });
        if (!rol) {
            return res.status(404).json({ message: 'Rol no encontrado' });
        }
        return res.status(200).json(rol);
    } catch (error) {
        return handleRoleError(res, 'getRolById', error, 'Error al obtener rol');
    }
};

const createRol = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const payload = {
            nombre: req.body.nombre_rol
        };
        if (req.body.id_estado !== undefined) {
            payload.id_estado = req.body.id_estado;
        }

        const newRol = await models.rol.create(payload, { transaction });
        const normalizedPermisos = req.normalizedPermisos;

        if (normalizedPermisos && normalizedPermisos.length > 0) {
            const validation = await validatePermisosYPrivilegios(normalizedPermisos, transaction);
            if (!validation.valid) {
                await transaction.rollback();
                return res.status(400).json({ message: validation.message });
            }
            await replaceRolePermissions({
                roleId: newRol.id_rol,
                normalizedPermisos,
                transaction
            });
        }

        await transaction.commit();

        const createdRole = await models.rol.findByPk(newRol.id_rol, {
            include: ROLE_INCLUDE_CONFIG
        });
        return res.status(201).json(createdRole || newRol);
    } catch (error) {
        await transaction.rollback();
        return handleRoleError(res, 'createRol', error, 'Error al crear rol');
    }
};

const updateRol = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const rol = req.rol || (await models.rol.findByPk(req.params.id, { transaction }));
        if (!rol) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Rol no encontrado' });
        }

        const updatePayload = {};
        if (req.body.nombre_rol !== undefined) {
            updatePayload.nombre = req.body.nombre_rol;
        }
        if (req.body.id_estado !== undefined) {
            updatePayload.id_estado = req.body.id_estado;
        }

        if (Object.keys(updatePayload).length > 0) {
            await rol.update(updatePayload, { transaction });
        }

        if (req.hasPermisosInput) {
            const normalizedPermisos = req.normalizedPermisos || [];
            if (normalizedPermisos.length > 0) {
                const validation = await validatePermisosYPrivilegios(normalizedPermisos, transaction);
                if (!validation.valid) {
                    await transaction.rollback();
                    return res.status(400).json({ message: validation.message });
                }
            }

            await replaceRolePermissions({
                roleId: rol.id_rol,
                normalizedPermisos,
                transaction
            });
        }

        await transaction.commit();

        const updatedRole = await models.rol.findByPk(rol.id_rol, {
            include: ROLE_INCLUDE_CONFIG
        });
        return res.status(200).json(updatedRole || rol);
    } catch (error) {
        await transaction.rollback();
        return handleRoleError(res, 'updateRol', error, 'Error al actualizar rol');
    }
};

const deleteRol = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const rol = req.rol || (await models.rol.findByPk(req.params.id, { transaction }));
        if (!rol) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Rol no encontrado' });
        }

        if (PROTECTED_ROLE_IDS.has(Number(rol.id_rol))) {
            await transaction.rollback();
            return res.status(403).json({
                message: `No se puede eliminar un rol protegido (id_rol=${rol.id_rol}).`
            });
        }

        await models.detallesrol.destroy({
            where: { id_rol: rol.id_rol },
            transaction
        });
        await models.roles_usuarios.destroy({
            where: { id_rol: rol.id_rol },
            transaction
        });
        await rol.destroy({ transaction });

        await transaction.commit();
        return res.status(200).json({ message: 'Rol eliminado' });
    } catch (error) {
        await transaction.rollback();
        if (error?.name === 'SequelizeForeignKeyConstraintError') {
            return res.status(400).json({
                message: 'No se puede eliminar el rol porque tiene referencias asociadas.'
            });
        }
        return handleRoleError(res, 'deleteRol', error, 'Error al eliminar rol');
    }
};

const assignPermissionsAndPrivileges = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const rol = req.rol || (await models.rol.findByPk(req.params.id, { transaction }));
        if (!rol) {
            await transaction.rollback();
            return res.status(404).json({ message: 'Rol no encontrado' });
        }

        const normalizedPermisos = req.normalizedPermisos || [];
        if (normalizedPermisos.length > 0) {
            const validation = await validatePermisosYPrivilegios(normalizedPermisos, transaction);
            if (!validation.valid) {
                await transaction.rollback();
                return res.status(400).json({ message: validation.message });
            }
        }

        await replaceRolePermissions({
            roleId: rol.id_rol,
            normalizedPermisos,
            transaction
        });

        await transaction.commit();
        return res.status(200).json({
            message: 'Permisos asociados exitosamente al rol',
            rol: rol.nombre,
            total_asociaciones: normalizedPermisos.length
        });
    } catch (error) {
        await transaction.rollback();
        return handleRoleError(
            res,
            'assignPermissionsAndPrivileges',
            error,
            'Error al asociar permisos al rol'
        );
    }
};

module.exports = {
    getRoles,
    getRolById,
    createRol,
    updateRol,
    deleteRol,
    assignPermissionsAndPrivileges
};
