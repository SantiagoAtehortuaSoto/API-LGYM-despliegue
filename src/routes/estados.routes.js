const { Router } = require('express');
const router = Router();
const { getEstados, getEstadoById, createEstado, updateEstado, deleteEstado } = require('../controllers/estados.controller');
const {
    normalizeEstadoPayload,
    checkEstadoExists,
    validateEstadoCreate,
    validateEstadoUpdate
} = require('../middleware/estados.validator');

router.get('/', getEstados);
router.get('/:id', checkEstadoExists, getEstadoById);
router.post('/', normalizeEstadoPayload, validateEstadoCreate, createEstado);
router.put('/:id', checkEstadoExists, normalizeEstadoPayload, validateEstadoUpdate, updateEstado);
router.delete('/:id', checkEstadoExists, deleteEstado);

module.exports = router;
