const { Router } = require('express');
const router = Router();

const { normalizeLandingOrder } = require('../middleware/landing_checkout.middleware');
const { validateVentaCreate } = require('../middleware/ventas.middleware');
const ventasController = require('../controllers/ventas.controller');

// Endpoint usado desde la landing para generar comprobante con estado pendiente
router.post('/comprobante', normalizeLandingOrder, validateVentaCreate, ventasController.createVenta);

module.exports = router;
