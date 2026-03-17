const express = require('express');
const router = express.Router();

const { enviarCorreoProveedorPedido } = require('../controllers/compras.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');

router.post('/', auth, authorizeCrud('Compras'), enviarCorreoProveedorPedido);
router.post('/:id', auth, authorizeCrud('Compras'), enviarCorreoProveedorPedido);

module.exports = router;
