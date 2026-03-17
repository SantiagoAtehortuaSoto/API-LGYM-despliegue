const { Router } = require('express');
const router = Router();

const {
  listCaracteristicas,
  getCaracteristicaById,
  createCaracteristica,
  updateCaracteristica,
  deleteCaracteristica
} = require('../controllers/caracteristicas.controller');

const {
  checkCaracteristicaExists,
  validateCaracteristicaCreate,
  validateCaracteristicaUpdate
} = require('../middleware/caracteristicas.validator');

router.get('/', listCaracteristicas);
router.get('/:id', checkCaracteristicaExists, getCaracteristicaById);
router.post('/', validateCaracteristicaCreate, createCaracteristica);
router.patch('/:id', checkCaracteristicaExists, validateCaracteristicaUpdate, updateCaracteristica);
router.delete('/:id', checkCaracteristicaExists, deleteCaracteristica);

module.exports = router;
