const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const normalizeRoleAssignmentPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = {};

    const idUsuario = body.id_usuario ?? body.idUsuario ?? body.usuarioId ?? body.userId;
    if (idUsuario !== undefined && idUsuario !== null && idUsuario !== '') {
        const parsed = Number(idUsuario);
        normalized.id_usuario = Number.isNaN(parsed) ? idUsuario : parsed;
    }

    const idRol = body.id_rol ?? body.idRol ?? body.rolId;
    if (idRol !== undefined && idRol !== null && idRol !== '') {
        const parsed = Number(idRol);
        normalized.id_rol = Number.isNaN(parsed) ? idRol : parsed;
    }

    req.body = normalized;
    next();
};

const ensureUsuarioExists = async (idUsuario) => {
    const usuario = await models.usuarios.findByPk(idUsuario, { attributes: ['id_usuario'] });
    if (!usuario) {
        throw new Error(`El usuario con id ${idUsuario} no existe.`);
    }
    return true;
};

const ensureRolExists = async (idRol) => {
    const rol = await models.rol.findByPk(idRol, { attributes: ['id_rol'] });
    if (!rol) {
        throw new Error(`El rol con id ${idRol} no existe.`);
    }
    return true;
};

const validateAssignRole = [
    check('id_usuario')
        .exists({ checkNull: true })
        .withMessage('id_usuario es requerido')
        .bail()
        .isInt({ min: 1 })
        .withMessage('id_usuario debe ser numerico y mayor a 0')
        .bail()
        .custom(ensureUsuarioExists),
    check('id_rol')
        .exists({ checkNull: true })
        .withMessage('id_rol es requerido')
        .bail()
        .isInt({ min: 1 })
        .withMessage('id_rol debe ser numerico y mayor a 0')
        .bail()
        .custom(ensureRolExists),
    validateResult,
    async (req, res, next) => {
        try {
            const { id_usuario, id_rol } = req.body;
            const existingAssignment = await models.roles_usuarios.findOne({
                where: { id_usuario, id_rol },
                attributes: ['id_rol_usuario']
            });

            if (existingAssignment) {
                return res.status(409).json({ message: 'Este usuario ya tiene el rol asignado.' });
            }

            req.assignmentPayload = { id_usuario, id_rol };
            return next();
        } catch (error) {
            console.error('[RolesUsuarios][validateAssignRole]', error);
            return res.status(500).json({
                message: 'Error interno durante la validacion de asignacion de rol.'
            });
        }
    }
];

const checkRoleAssignmentExists = [
    param('id_usuario')
        .isInt({ min: 1 })
        .withMessage('id_usuario debe ser numerico y mayor a 0')
        .bail()
        .custom(ensureUsuarioExists),
    param('id_rol')
        .isInt({ min: 1 })
        .withMessage('id_rol debe ser numerico y mayor a 0')
        .bail()
        .custom(ensureRolExists),
    validateResult,
    async (req, res, next) => {
        try {
            const id_usuario = Number(req.params.id_usuario);
            const id_rol = Number(req.params.id_rol);
            const assignment = await models.roles_usuarios.findOne({
                where: { id_usuario, id_rol }
            });

            if (!assignment) {
                return res.status(404).json({ message: 'La asignacion de rol no fue encontrada.' });
            }

            req.roleAssignment = assignment;
            return next();
        } catch (error) {
            console.error('[RolesUsuarios][checkRoleAssignmentExists]', error);
            return res.status(500).json({
                message: 'Error interno al validar la asignacion de rol.'
            });
        }
    }
];

const validateUserRolesParam = [
    param('id_usuario')
        .isInt({ min: 1 })
        .withMessage('id_usuario debe ser numerico y mayor a 0')
        .bail()
        .custom(ensureUsuarioExists),
    validateResult,
    (req, _res, next) => {
        req.targetUserId = Number(req.params.id_usuario);
        next();
    }
];

module.exports = {
    normalizeRoleAssignmentPayload,
    validateAssignRole,
    checkRoleAssignmentExists,
    validateUserRolesParam
};
