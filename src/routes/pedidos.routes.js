const { Router } = require('express');
const router = Router();

const {
    createPedido,
    getPedidos,
    getPedidoById,
    updatePedido,
    deletePedido
} = require('../controllers/pedidos.controller');
const { auth } = require('../middleware/auth');
const {
    checkPedidoExists,
    validatePedidoCreate,
    validatePedidoUpdate
} = require('../middleware/pedidos.validator');

router.post('/', auth, validatePedidoCreate, createPedido);
router.get('/', auth, getPedidos);
router.get('/:id', auth, checkPedidoExists, getPedidoById);
router.put('/:id', auth, checkPedidoExists, validatePedidoUpdate, updatePedido);
router.delete('/:id', auth, checkPedidoExists, deletePedido);

module.exports = router;
