const { Router } = require('express');
const router = Router();

const empleadosController = require('../controllers/empleados.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');
const {
    checkEmpleadoExists,
    normalizeEmpleadoPayload,
    validateEmpleadoCreate,
    validateEmpleadoUpdate
} = require('../middleware/empleados.validator');

// Todas las rutas requieren autenticación y permiso del módulo "Empleados"
router.use(auth);

router.get(
    '/',
    authorizeCrud('Empleados'),
    empleadosController.listEmpleados
);

router.get(
    '/:id',
    authorizeCrud('Empleados'),
    checkEmpleadoExists,
    empleadosController.getEmpleadoById
);

router.post(
    '/',
    authorizeCrud('Empleados'),
    normalizeEmpleadoPayload,
    validateEmpleadoCreate,
    empleadosController.createEmpleado
);

router.put(
    '/:id',
    authorizeCrud('Empleados'),
    normalizeEmpleadoPayload,
    validateEmpleadoUpdate,
    empleadosController.updateEmpleado
);

router.delete(
    '/:id',
    authorizeCrud('Empleados'),
    checkEmpleadoExists,
    empleadosController.deleteEmpleado
);

module.exports = router;
