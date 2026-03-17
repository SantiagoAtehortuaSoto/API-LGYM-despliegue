const { Router } = require('express');
const router = Router();

const {
    getRoles,
    getRolById,
    createRol,
    updateRol,
    deleteRol,
    assignPermissionsAndPrivileges
} = require('../controllers/rol.controller');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorization');
const {
    normalizeRolPayload,
    checkRolExists,
    validateRolCreate,
    validateRolUpdate,
    validateAssignPermissions
} = require('../middleware/rol.validator');

router.use(auth);

router.get('/', authorize({ permiso: 'Roles', privilegios: ['ver'] }), getRoles);
router.get('/:id', authorize({ permiso: 'Roles', privilegios: ['ver'] }), checkRolExists, getRolById);
router.post(
    '/',
    authorize({ permiso: 'Roles', privilegios: ['crear'] }),
    normalizeRolPayload,
    validateRolCreate,
    createRol
);
router.post(
    '/:id/assign-permissions',
    authorize({ permiso: 'Roles', privilegios: ['editar'] }),
    checkRolExists,
    normalizeRolPayload,
    validateAssignPermissions,
    assignPermissionsAndPrivileges
);
router.put(
    '/:id',
    authorize({ permiso: 'Roles', privilegios: ['editar'] }),
    checkRolExists,
    normalizeRolPayload,
    validateRolUpdate,
    updateRol
);
router.delete(
    '/:id',
    authorize({ permiso: 'Roles', privilegios: ['eliminar'] }),
    checkRolExists,
    deleteRol
);

module.exports = router;
