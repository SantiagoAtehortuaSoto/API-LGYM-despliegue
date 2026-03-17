const { Router } = require('express');
const router = Router();
const {
  listAgendas,
  listMyAgendas,
  getAgendaById,
  createAgenda,
  updateAgenda,
  deleteAgenda
} = require('../controllers/agenda.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrudAny } = require('../middleware/authorization');
const {
  checkAgendaExists,
  validateAgendaCreate,
  validateAgendaUpdate,
  requireAgendaRequester,
  authorizeAgendaOwnerOrAdmin
} = require('../middleware/agenda.validator');

router.use(auth);

// Compatibilidad: mientras se migra la matriz de roles, acepta "Citas" o "Asistencia".
router.get('/', authorizeCrudAny('Citas', 'Asistencia'), listAgendas);
router.get('/mias', authorizeCrudAny('Citas', 'Asistencia'), requireAgendaRequester, listMyAgendas);
router.get(
  '/:id',
  authorizeCrudAny('Citas', 'Asistencia'),
  checkAgendaExists,
  requireAgendaRequester,
  authorizeAgendaOwnerOrAdmin,
  getAgendaById
);
router.post('/', authorizeCrudAny('Citas', 'Asistencia'), validateAgendaCreate, createAgenda);
router.patch('/:id', authorizeCrudAny('Citas', 'Asistencia'), checkAgendaExists, validateAgendaUpdate, updateAgenda);
router.delete('/:id', authorizeCrudAny('Citas', 'Asistencia'), checkAgendaExists, deleteAgenda);

module.exports = router;
