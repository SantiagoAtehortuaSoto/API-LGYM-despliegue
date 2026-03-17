const express = require('express');
const router = express.Router();

const controller = require('../controllers/membresias.controller');
const { auth } = require('../middleware/auth');
const { authorizeCrudAny } = require('../middleware/authorization');
const {
    normalizeMembresiaPayload,
    checkMembresiaExists,
    validateMembresiaCreate,
    validateMembresiaUpdate
} = require('../middleware/membresias.validator');

router.get('/', controller.findAll);
router.get('/:id', checkMembresiaExists, controller.findOne);

router.post(
    '/',
    auth,
    authorizeCrudAny('Ventas Membresias', 'Membresias', 'Membresias'),
    normalizeMembresiaPayload,
    validateMembresiaCreate,
    controller.create
);

router.put(
    '/:id',
    auth,
    authorizeCrudAny('Ventas Membresias', 'Membresias', 'Membresias'),
    checkMembresiaExists,
    normalizeMembresiaPayload,
    validateMembresiaUpdate,
    controller.update
);

router.delete(
    '/:id',
    auth,
    authorizeCrudAny('Ventas Membresias', 'Membresias', 'Membresias'),
    checkMembresiaExists,
    controller.remove
);

module.exports = router;
