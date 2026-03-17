const { Router } = require('express');
const router = Router();
const {
  listRelaciones,
  getRelacionById,
  createRelacion,
  updateRelacion,
  deleteRelacion
} = require('../controllers/relacion_seguimiento_caracteristica.controller');
const {
  normalizeRelacionPayload,
  checkRelacionExists,
  validateRelacionCreate,
  validateRelacionUpdate
} = require('../middleware/relacion_seguimiento_caracteristica.validator');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');

router.use(auth);

router.get('/', authorizeCrud('Seguimiento deportivo'), listRelaciones);
router.get('/:id', authorizeCrud('Seguimiento deportivo'), checkRelacionExists, getRelacionById);
router.post('/', authorizeCrud('Seguimiento deportivo'), normalizeRelacionPayload, validateRelacionCreate, createRelacion);
router.patch('/:id', authorizeCrud('Seguimiento deportivo'), checkRelacionExists, normalizeRelacionPayload, validateRelacionUpdate, updateRelacion);
router.delete('/:id', authorizeCrud('Seguimiento deportivo'), checkRelacionExists, deleteRelacion);

module.exports = router;
