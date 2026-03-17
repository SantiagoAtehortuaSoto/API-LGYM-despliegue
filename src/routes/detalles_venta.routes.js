const { Router } = require('express');
const router = Router();

const detallesVentaController = require('../controllers/detalles_venta.controller');
const {
    validateDetallesVentaListQuery,
    checkDetalleVentaExists
} = require('../middleware/detalles_venta.middleware');
// Nota: detalles_venta se genera a traves de /ventas (ver ventas.controller).
// Exponemos solo lectura para evitar modificaciones directas.

router.get('/', validateDetallesVentaListQuery, detallesVentaController.getDetallesVenta);
router.get('/:id', checkDetalleVentaExists, detallesVentaController.getDetalleVentaById);

module.exports = router;
