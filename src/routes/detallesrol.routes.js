const { Router } = require('express');
const router = Router();
const { getDetallesRol } = require('../controllers/detallesrol.controller');
const { auth } = require('../middleware/auth');
const { authorize } = require('../middleware/authorization');
const { validateDetallesRolListQuery } = require('../middleware/detallesrol.validator');

router.get(
    '/',
    auth,
    authorize({ permiso: 'Roles', privilegios: ['ver'] }),
    validateDetallesRolListQuery,
    getDetallesRol
);

module.exports = router;
