const { Router } = require('express');
const router = Router();

const {
    getAllAssignments,
    assignRoleToUser,
    removeRoleFromUser,
    getRolesByUserId
} = require('../controllers/roles_usuarios.controller');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorization');
const {
    normalizeRoleAssignmentPayload,
    validateAssignRole,
    checkRoleAssignmentExists,
    validateUserRolesParam
} = require('../middleware/roles_usuarios.validator');

router.get(
    '/',
    auth,
    authorize({ permiso: 'Roles', privilegios: ['ver'] }),
    getAllAssignments
);

router.get(
    '/usuario/:id_usuario',
    auth,
    authorize({ permiso: 'Roles', privilegios: ['ver'] }),
    validateUserRolesParam,
    getRolesByUserId
);

router.post(
    '/',
    auth,
    authorize({ permiso: 'Roles', privilegios: ['editar'] }),
    normalizeRoleAssignmentPayload,
    validateAssignRole,
    assignRoleToUser
);

router.delete(
    '/:id_usuario/:id_rol',
    auth,
    authorize({ permiso: 'Roles', privilegios: ['editar'] }),
    checkRoleAssignmentExists,
    removeRoleFromUser
);

module.exports = router;
