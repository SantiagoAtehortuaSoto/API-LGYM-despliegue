const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const ASSIGNMENT_INCLUDE = [
    {
        model: models.usuarios,
        as: 'id_usuario_usuario',
        attributes: ['id_usuario', 'nombre_usuario', 'email']
    },
    {
        model: models.rol,
        as: 'id_rol_rol',
        attributes: ['id_rol', 'nombre', 'id_estado']
    }
];

const handleRoleAssignmentError = (res, method, error, fallbackMessage) => {
    console.error(`[RolesUsuarios][${method}]`, error);
    if (error?.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ message: 'Esta asignacion de rol ya existe para este usuario.' });
    }
    if (error?.name === 'SequelizeForeignKeyConstraintError') {
        return res.status(400).json({ message: 'El usuario o el rol especificado no existe.' });
    }
    return res.status(500).json({ message: fallbackMessage });
};

const getAllAssignments = async (req, res) => {
    try {
        const assignments = await paginateModel(models.roles_usuarios, req, {
            additionalSearchFields: [
                'id_usuario_usuario.nombre_usuario',
                'id_usuario_usuario.email',
                'id_rol_rol.nombre'
            ],
            include: ASSIGNMENT_INCLUDE,
            order: [['id_rol_usuario', 'ASC']]
        });
        return res.status(200).json(assignments);
    } catch (error) {
        return handleRoleAssignmentError(
            res,
            'getAllAssignments',
            error,
            'Error al obtener asignaciones de roles.'
        );
    }
};

const assignRoleToUser = async (req, res) => {
    const payload = req.assignmentPayload || req.body;
    try {
        const newAssignment = await models.roles_usuarios.create({
            id_usuario: payload.id_usuario,
            id_rol: payload.id_rol
        });

        const assignmentWithRelations = await models.roles_usuarios.findByPk(newAssignment.id_rol_usuario, {
            include: ASSIGNMENT_INCLUDE
        });

        return res.status(201).json({
            message: 'Rol asignado correctamente.',
            assignment: assignmentWithRelations || newAssignment
        });
    } catch (error) {
        return handleRoleAssignmentError(
            res,
            'assignRoleToUser',
            error,
            'Error al asignar el rol.'
        );
    }
};

const removeRoleFromUser = async (req, res) => {
    try {
        const assignment = req.roleAssignment || (await models.roles_usuarios.findOne({
            where: {
                id_usuario: Number(req.params.id_usuario),
                id_rol: Number(req.params.id_rol)
            }
        }));

        if (!assignment) {
            return res.status(404).json({ message: 'La asignacion de rol no fue encontrada.' });
        }

        await assignment.destroy();
        return res.status(200).json({ message: 'Rol removido del usuario correctamente.' });
    } catch (error) {
        return handleRoleAssignmentError(
            res,
            'removeRoleFromUser',
            error,
            'Error al remover el rol del usuario.'
        );
    }
};

const getRolesByUserId = async (req, res) => {
    const id_usuario = req.targetUserId ?? Number(req.params.id_usuario);
    try {
        const userRoles = await models.roles_usuarios.findAll({
            where: { id_usuario },
            include: [
                {
                    model: models.rol,
                    as: 'id_rol_rol',
                    attributes: ['id_rol', 'nombre', 'id_estado']
                }
            ],
            order: [['id_rol_usuario', 'ASC']]
        });

        const roles = userRoles
            .map((item) => item.id_rol_rol)
            .filter(Boolean);

        return res.status(200).json(roles);
    } catch (error) {
        return handleRoleAssignmentError(
            res,
            'getRolesByUserId',
            error,
            'Error al obtener roles del usuario.'
        );
    }
};

module.exports = {
    getAllAssignments,
    assignRoleToUser,
    removeRoleFromUser,
    getRolesByUserId
};
