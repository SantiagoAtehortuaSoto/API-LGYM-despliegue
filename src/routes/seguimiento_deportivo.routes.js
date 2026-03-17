const { Router } = require('express');
const router = Router();
const {
  listSeguimientos,
  getSeguimientoById,
  createSeguimiento,
  updateSeguimiento,
  deleteSeguimiento
} = require('../controllers/seguimiento_deportivo.controller');
const {
  normalizeSeguimientoPayload,
  checkSeguimientoExists,
  validateSeguimientoCreate,
  validateSeguimientoUpdate
} = require('../middleware/seguimiento_deportivo.validator');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');

router.use(auth);

router.get('/', authorizeCrud('Seguimiento deportivo'), listSeguimientos);
router.get('/:id', authorizeCrud('Seguimiento deportivo'), checkSeguimientoExists, getSeguimientoById);
router.post(
  '/',
  authorizeCrud('Seguimiento deportivo'),
  normalizeSeguimientoPayload,
  validateSeguimientoCreate,
  createSeguimiento
);
router.patch(
  '/:id',
  authorizeCrud('Seguimiento deportivo'),
  checkSeguimientoExists,
  normalizeSeguimientoPayload,
  validateSeguimientoUpdate,
  updateSeguimiento
);
router.delete('/:id', authorizeCrud('Seguimiento deportivo'), checkSeguimientoExists, deleteSeguimiento);

module.exports = router;
