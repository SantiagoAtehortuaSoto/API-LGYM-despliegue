const { Router } = require('express');
const router = Router();

const ventasController = require('../controllers/ventas.controller');
const { validateVentaCreate, validateVentaUpdate } = require('../middleware/ventas.middleware');
const { auth } = require('../middleware/auth');
const { authorizeCrudAny } = require('../middleware/authorization');

router.get('/', auth, authorizeCrudAny('Ventas Membresias', 'Ventas'), ventasController.getVentas);
router.get('/pendientes', auth, authorizeCrudAny('Ventas Membresias', 'Ventas'), ventasController.getVentasPendientes);
router.get('/finalizadas', auth, authorizeCrudAny('Ventas Membresias', 'Ventas'), ventasController.getVentasFinalizadas);
router.get('/usuario/:id_usuario', auth, authorizeCrudAny('Ventas Membresias', 'Ventas'), ventasController.getVentasByUsuario);
router.get('/mias', auth, authorizeCrudAny('Ventas Membresias', 'Ventas'), ventasController.getVentasAutenticado);
router.get('/:id', auth, authorizeCrudAny('Ventas Membresias', 'Ventas'), ventasController.getVentaById);
router.post('/', auth, authorizeCrudAny('Ventas Membresias', 'Ventas'), validateVentaCreate, ventasController.createVenta);
router.put('/:id', auth, authorizeCrudAny('Ventas Membresias', 'Ventas'), validateVentaUpdate, ventasController.updateVenta);
router.delete('/:id', auth, authorizeCrudAny('Ventas Membresias', 'Ventas'), ventasController.deleteVenta);

module.exports = router;
