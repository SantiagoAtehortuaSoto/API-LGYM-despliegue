const { Router } = require('express');
const router = Router();

const {
    getProveedores,
    getProveedorById,
    createProveedor,
    updateProveedor,
    deleteProveedor
} = require('../controllers/proveedores.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');
const {
    normalizeProveedorPayload,
    validateProveedorCreate,
    validateProveedorUpdate,
    checkProveedorExists
} = require('../middleware/proveedores.validator');

router.get('/', getProveedores);
router.get('/:id', checkProveedorExists, getProveedorById);

router.post(
    '/',
    auth,
    authorizeCrud('Proveedores'),
    normalizeProveedorPayload,
    validateProveedorCreate,
    createProveedor
);

router.put(
    '/:id',
    auth,
    authorizeCrud('Proveedores'),
    checkProveedorExists,
    normalizeProveedorPayload,
    validateProveedorUpdate,
    updateProveedor
);

router.delete(
    '/:id',
    auth,
    authorizeCrud('Proveedores'),
    checkProveedorExists,
    deleteProveedor
);

module.exports = router;
