const { Router } = require('express');
const router = Router();
const {
  listDetallesSeguimiento,
  getDetalleSeguimientoById,
  createDetalleSeguimiento,
  updateDetalleSeguimiento,
  deleteDetalleSeguimiento
} = require('../controllers/detalle_seguimiento.controller');
const {
  checkDetalleSeguimientoExists,
  validateDetalleSeguimientoCreate,
  validateDetalleSeguimientoUpdate
} = require('../middleware/detalle_seguimiento.validator');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');

router.use(auth);

router.get('/', authorizeCrud('Seguimiento deportivo'), listDetallesSeguimiento);
router.get('/:id', authorizeCrud('Seguimiento deportivo'), checkDetalleSeguimientoExists, getDetalleSeguimientoById);
router.post('/', authorizeCrud('Seguimiento deportivo'), validateDetalleSeguimientoCreate, createDetalleSeguimiento);
router.patch('/:id', authorizeCrud('Seguimiento deportivo'), checkDetalleSeguimientoExists, validateDetalleSeguimientoUpdate, updateDetalleSeguimiento);
router.delete('/:id', authorizeCrud('Seguimiento deportivo'), checkDetalleSeguimientoExists, deleteDetalleSeguimiento);

module.exports = router;
