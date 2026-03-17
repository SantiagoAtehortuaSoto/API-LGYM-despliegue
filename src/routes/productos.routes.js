const { Router } = require('express');
const router = Router();

const {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
} = require('../controllers/productos.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');
const {
    normalizeProductPayload,
    checkProductExists,
    validateProductCreate,
    validateProductUpdate
} = require('../middleware/product.validator');

// Rutas publicas para visualizacion
router.get('/', getProducts);
router.get('/:id', checkProductExists, getProductById);

// Rutas protegidas para administracion
router.post(
    '/',
    auth,
    authorizeCrud('Productos'),
    normalizeProductPayload,
    validateProductCreate,
    createProduct
);
router.put(
    '/:id',
    auth,
    authorizeCrud('Productos'),
    checkProductExists,
    normalizeProductPayload,
    validateProductUpdate,
    updateProduct
);
router.delete(
    '/:id',
    auth,
    authorizeCrud('Productos'),
    checkProductExists,
    deleteProduct
);

module.exports = router;
