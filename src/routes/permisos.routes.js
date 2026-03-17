const { Router } = require('express');
const router = Router();

const {
    getPermisos,
    getPermisoById,
    createPermiso,
    updatePermiso,
    deletePermiso
} = require('../controllers/permisos.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');
const {
    normalizePermisoPayload,
    validatePermisoListQuery,
    checkPermisoExists,
    validatePermisoCreate,
    validatePermisoUpdate
} = require('../middleware/permisos.validator');

router.use(auth);

// Usamos el modulo "Roles" para administrar permisos (no existe un permiso llamado "Permisos" en la tabla).
router.get('/', authorizeCrud('Roles'), validatePermisoListQuery, getPermisos);
router.get('/:id', authorizeCrud('Roles'), checkPermisoExists, getPermisoById);
router.post(
    '/',
    authorizeCrud('Roles'),
    normalizePermisoPayload,
    validatePermisoCreate,
    createPermiso
);
router.put(
    '/:id',
    authorizeCrud('Roles'),
    checkPermisoExists,
    normalizePermisoPayload,
    validatePermisoUpdate,
    updatePermiso
);
router.delete('/:id', authorizeCrud('Roles'), checkPermisoExists, deletePermiso);

module.exports = router;
