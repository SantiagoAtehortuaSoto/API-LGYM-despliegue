const { Router } = require('express');
const router = Router();
const {
  listAsistenciaEmpleados,
  getAsistenciaEmpleadoById,
  createAsistenciaEmpleado,
  updateAsistenciaEmpleado,
  deleteAsistenciaEmpleado
} = require('../controllers/asistencia_empleado.controller');
const {
  checkAsistenciaEmpleadoExists,
  validateAsistenciaEmpleadoCreate,
  validateAsistenciaEmpleadoUpdate
} = require('../middleware/asistencia_empleado.validator');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');

router.use(auth);

router.get('/', authorizeCrud('Asistencia'), listAsistenciaEmpleados);
router.get('/:id', authorizeCrud('Asistencia'), checkAsistenciaEmpleadoExists, getAsistenciaEmpleadoById);
router.post('/', authorizeCrud('Asistencia'), validateAsistenciaEmpleadoCreate, createAsistenciaEmpleado);
router.patch('/:id', authorizeCrud('Asistencia'), checkAsistenciaEmpleadoExists, validateAsistenciaEmpleadoUpdate, updateAsistenciaEmpleado);
router.delete('/:id', authorizeCrud('Asistencia'), checkAsistenciaEmpleadoExists, deleteAsistenciaEmpleado);

module.exports = router;
