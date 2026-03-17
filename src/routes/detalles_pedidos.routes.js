const { Router } = require('express');
const router = Router();
const {
    createDetallePedido,
    getDetallesPedidos,
    getDetallePedidoById,
    updateDetallePedido,
    deleteDetallePedido
} = require('../controllers/detalles_pedidos.controller');

// Middleware de autenticación (ejemplo, ajusta según tu implementación)
const { auth } = require('../middleware/auth');
const { checkDetallesPedidosExists, validateDetallesPedidosCreate, validateDetallesPedidosUpdate } = require('../middleware/detalles_pedidos.validator');

// Rutas para Detalles de Pedidos
router.post('/', auth, validateDetallesPedidosCreate, createDetallePedido);
router.get('/', auth, getDetallesPedidos);
router.get('/:id', auth, checkDetallesPedidosExists, getDetallePedidoById);
router.put('/:id', auth, checkDetallesPedidosExists, validateDetallesPedidosUpdate, updateDetallePedido);
router.delete('/:id', auth, checkDetallesPedidosExists, deleteDetallePedido);

module.exports = router;
