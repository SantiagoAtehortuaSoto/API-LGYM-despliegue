const express = require('express');
const router = express.Router();
const {
    createCompra,
    getCompras,
    getComprasPendientes,
    getComprasFinalizadas,
    getCompraById,
    updateCompra,
    deleteCompra
} = require('../controllers/compras.controller');
const { normalizeCompraPayload, validateCompraCreate, validateCompraUpdate } = require('../middleware/compras.validator');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');

router.post('/', auth, authorizeCrud('Compras'), normalizeCompraPayload, validateCompraCreate, createCompra);
router.get('/', auth, authorizeCrud('Compras'), getCompras);
router.get('/pendientes', auth, authorizeCrud('Compras'), getComprasPendientes);
router.get('/finalizadas', auth, authorizeCrud('Compras'), getComprasFinalizadas);
router.get('/:id', auth, authorizeCrud('Compras'), getCompraById);
router.put('/:id', auth, authorizeCrud('Compras'), normalizeCompraPayload, validateCompraUpdate, updateCompra);
router.delete('/:id', auth, authorizeCrud('Compras'), deleteCompra);

module.exports = router;
