const { check } = require('express-validator');
const { validateResult } = require('./validator');

const validateContactForm = [
    check('nombre')
        .exists({ checkFalsy: true }).withMessage('El nombre es requerido')
        .bail()
        .isString().withMessage('El nombre debe ser texto')
        .trim()
        .isLength({ max: 120 }).withMessage('El nombre excede la longitud permitida'),
    check('email')
        .exists({ checkFalsy: true }).withMessage('El email es requerido')
        .bail()
        .isEmail().withMessage('Debe ser un email valido')
        .normalizeEmail(),
    check('telefono')
        .exists({ checkFalsy: true }).withMessage('El telefono es requerido')
        .bail()
        .isString().withMessage('El telefono debe ser texto')
        .trim()
        .matches(/^[0-9+\s()\-]{7,20}$/).withMessage('El telefono tiene un formato invalido'),
    check('mensaje')
        .exists({ checkFalsy: true }).withMessage('El mensaje es requerido')
        .bail()
        .isString().withMessage('El mensaje debe ser texto')
        .trim()
        .isLength({ max: 2000 }).withMessage('El mensaje excede la longitud permitida'),
    validateResult
];

const normalizeContactPayload = (req, _res, next) => {
    const { nombre, email, telefono, mensaje } = req.body;
    req.contactPayload = {
        nombre: nombre.trim(),
        email: email.trim().toLowerCase(),
        telefono: telefono.trim(),
        mensaje: mensaje.trim()
    };
    next();
};

const resolveContactCompanyEmail = (req, res, next) => {
    const companyEmail = process.env.BUSINESS_EMAIL || process.env.COMPANY_EMAIL || process.env.EMAIL_USER;
    if (!companyEmail) {
        console.error(
            '[Contactanos][resolveContactCompanyEmail] Falta configuracion de email destino. ' +
            'Define BUSINESS_EMAIL, COMPANY_EMAIL o EMAIL_USER.'
        );
        return res.status(500).json({
            message: 'Configuracion incompleta para procesar mensajes de contacto'
        });
    }
    req.companyEmail = companyEmail;
    next();
};

module.exports = {
    validateContactForm,
    normalizeContactPayload,
    resolveContactCompanyEmail
};
