const { Router } = require('express');
const router = Router();

const {
    getPrivilegios,
    getPrivilegioById,
    createPrivilegio,
    updatePrivilegio,
    deletePrivilegio
} = require('../controllers/privilegios.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');
const {
    normalizePrivilegioPayload,
    checkPrivilegioExists,
    validatePrivilegioCreate,
    validatePrivilegioUpdate
} = require('../middleware/privilegios.validator');

router.use(auth);

// Usamos el modulo "Roles" para administrar privilegios (no existe permiso "Privilegios" en la tabla).
router.get('/', authorizeCrud('Roles'), getPrivilegios);
router.get('/:id', authorizeCrud('Roles'), checkPrivilegioExists, getPrivilegioById);
router.post(
    '/',
    authorizeCrud('Roles'),
    normalizePrivilegioPayload,
    validatePrivilegioCreate,
    createPrivilegio
);
router.put(
    '/:id',
    authorizeCrud('Roles'),
    checkPrivilegioExists,
    normalizePrivilegioPayload,
    validatePrivilegioUpdate,
    updatePrivilegio
);
router.delete('/:id', authorizeCrud('Roles'), checkPrivilegioExists, deletePrivilegio);

module.exports = router;
