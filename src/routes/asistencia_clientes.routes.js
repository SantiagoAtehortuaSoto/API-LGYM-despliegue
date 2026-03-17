const { Router } = require('express');
const router = Router();
const {
  listAsistenciaClientes,
  getAsistenciaClienteById,
  createAsistenciaCliente,
  updateAsistenciaCliente,
  deleteAsistenciaCliente
} = require('../controllers/asistencia_clientes.controller');
const {
  checkAsistenciaClienteExists,
  validateAsistenciaClienteCreate,
  validateAsistenciaClienteUpdate
} = require('../middleware/asistencia_clientes.validator');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');

router.use(auth);

router.get('/', authorizeCrud('Asistencia'), listAsistenciaClientes);
router.get('/:id', authorizeCrud('Asistencia'), checkAsistenciaClienteExists, getAsistenciaClienteById);
router.post('/', authorizeCrud('Asistencia'), validateAsistenciaClienteCreate, createAsistenciaCliente);
router.patch('/:id', authorizeCrud('Asistencia'), checkAsistenciaClienteExists, validateAsistenciaClienteUpdate, updateAsistenciaCliente);
router.delete('/:id', authorizeCrud('Asistencia'), checkAsistenciaClienteExists, deleteAsistenciaCliente);

module.exports = router;
