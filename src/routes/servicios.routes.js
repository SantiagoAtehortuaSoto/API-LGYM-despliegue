const { Router } = require('express');
const router = Router();
const { getServicios, getServicioById, createServicio, updateServicio, deleteServicio } = require('../controllers/servicios.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');
const { checkServiceMembership } = require('../middleware/service.validator');

router.get('/', getServicios);
router.get('/:id', getServicioById);
router.post('/', [auth, authorizeCrud('Servicios')], createServicio);
router.put('/:id', [auth, authorizeCrud('Servicios')], updateServicio);
router.delete('/:id', [auth, authorizeCrud('Servicios'), checkServiceMembership], deleteServicio);

module.exports = router;
