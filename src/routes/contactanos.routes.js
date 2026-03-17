const { Router } = require('express');
const router = Router();
const { handleContactForm } = require('../controllers/contactanos.controller');
const {
    validateContactForm,
    normalizeContactPayload,
    resolveContactCompanyEmail
} = require('../middleware/contactanos.validator');

router.post('/', validateContactForm, normalizeContactPayload, resolveContactCompanyEmail, handleContactForm);

module.exports = router;
