const express = require('express');
const router = express.Router();
const controller = require('../controllers/detalles_membresias.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrudAny } = require('../middleware/authorization');
const {
    checkDetalleMembresiaExists,
    validateDetalleMembresiaCreate,
    validateDetalleMembresiaUpdate
} = require('../middleware/detalles_membresias.validator');

// Rutas para detalles de membresias
// GET publico para evitar 401 en consulta de listado/detalle.
router.get('/', controller.findAll);
router.get('/:id', checkDetalleMembresiaExists, controller.findOne);

// Escritura protegida
router.post('/', auth, authorizeCrudAny('Ventas Membresias', 'Membresias', 'Membresias'), validateDetalleMembresiaCreate, controller.create);
router.patch('/:id', auth, authorizeCrudAny('Ventas Membresias', 'Membresias', 'Membresias'), checkDetalleMembresiaExists, validateDetalleMembresiaUpdate, controller.update);
router.delete('/:id', auth, authorizeCrudAny('Ventas Membresias', 'Membresias', 'Membresias'), checkDetalleMembresiaExists, controller.remove);

module.exports = router;
