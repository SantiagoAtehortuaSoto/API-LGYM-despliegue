const { Router } = require('express');
const router = Router();
const {
  listMaestroParametros,
  getMaestroParametroById,
  createMaestroParametro,
  updateMaestroParametro,
  deleteMaestroParametro
} = require('../controllers/maestro_parametros.controller');
const {
  normalizeMaestroParametroPayload,
  checkMaestroParametroExists,
  validateMaestroParametroCreate,
  validateMaestroParametroUpdate
} = require('../middleware/maestro_parametros.validator');

router.get('/', listMaestroParametros);
router.get('/:id', checkMaestroParametroExists, getMaestroParametroById);
router.post('/', normalizeMaestroParametroPayload, validateMaestroParametroCreate, createMaestroParametro);
router.patch('/:id', checkMaestroParametroExists, normalizeMaestroParametroPayload, validateMaestroParametroUpdate, updateMaestroParametro);
router.delete('/:id', checkMaestroParametroExists, deleteMaestroParametro);

module.exports = router;
