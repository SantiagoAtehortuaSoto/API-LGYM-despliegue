const { body, param, validationResult } = require('express-validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const hasValue = (value) => value !== undefined && value !== null && value !== '';

const pickFirstValue = (...values) => values.find(hasValue);

const normalizeVentaUsuarioForCreate = (req, _res, next) => {
    if (!req.body || typeof req.body !== 'object') return next();
    if (hasValue(req.body.id_usuario)) return next();

    const resolved = pickFirstValue(
        req.body.id_cliente,
        req.body.idCliente,
        req.body.idUsuario,
        req.user?.id
    );

    if (hasValue(resolved)) {
        req.body.id_usuario = resolved;
    }

    next();
};

const normalizeVentaUsuarioForUpdate = (req, _res, next) => {
    if (!req.body || typeof req.body !== 'object') return next();
    if (hasValue(req.body.id_usuario)) return next();

    const resolved = pickFirstValue(req.body.id_cliente, req.body.idCliente, req.body.idUsuario);
    if (hasValue(resolved)) {
        req.body.id_usuario = resolved;
    }

    next();
};

const handleValidationResult = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        const payload = errors.array();
        const firstMessage = payload[0]?.msg || 'Error de validacion';
        return res.status(400).json({ message: firstMessage, errors: payload });
    }
    next();
};

const ensureUsuarioExists = async (id_usuario) => {
    const usuario = await models.usuarios.findByPk(id_usuario);
    if (!usuario) {
        throw new Error(`El usuario con id '${id_usuario}' no existe.`);
    }
};

const ensureEstadoExists = async (id_estado) => {
    if (id_estado === undefined || id_estado === null) return;
    const estado = await models.estados.findByPk(id_estado);
    if (!estado) {
        throw new Error(`El estado con id '${id_estado}' no existe.`);
    }
};

const detalleCreateRules = [
    body('detalles')
        .exists().withMessage('Debe proporcionar el arreglo "detalles"')
        .bail()
        .isArray({ min: 1 }).withMessage('El campo "detalles" debe ser un arreglo con al menos un elemento'),
    body('detalles.*.tipo_venta')
        .if(body('detalles').exists())
        .exists().withMessage('Cada detalle requiere "tipo_venta"')
        .bail()
        .isString().withMessage('"tipo_venta" debe ser texto')
        .notEmpty().withMessage('"tipo_venta" no puede estar vacio'),
    body('detalles.*.cantidad')
        .if(body('detalles').exists())
        .exists().withMessage('Cada detalle requiere "cantidad"')
        .bail()
        .isInt({ gt: 0 }).withMessage('"cantidad" debe ser un entero mayor a 0'),
    body('detalles.*.valor_unitario')
        .if(body('detalles').exists())
        .exists().withMessage('Cada detalle requiere "valor_unitario"')
        .bail()
        .isFloat({ min: 0 }).withMessage('"valor_unitario" debe ser numerico y >= 0'),
    body('detalles.*.id_producto')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_producto" debe ser numerico y mayor a 0'),
    body('detalles.*.id_membresia')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_membresia" debe ser numerico y mayor a 0'),
    body('detalles.*.id_servicio')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_servicio" debe ser numerico y mayor a 0'),
    body('detalles.*.id_relacion')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_relacion" (beneficiario) debe ser numerico y mayor a 0')
        .bail()
        .custom(async (value) => {
            await ensureUsuarioExists(value);
        }),
    body('detalles.*.id_estado_membresia')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_estado_membresia" debe ser numerico y mayor a 0'),
    body('detalles.*.perdidas_o_ganancias')
        .if(body('detalles').exists())
        .exists().withMessage('"perdidas_o_ganancias" es requerido')
        .bail()
        .isFloat().withMessage('"perdidas_o_ganancias" debe ser numerico')
];

const detalleUpdateRules = [
    body('detalles')
        .optional()
        .isArray({ min: 1 }).withMessage('Si envia "detalles" debe proveer al menos un elemento'),
    body('detalles.*.tipo_venta')
        .if(body('detalles').exists())
        .exists().withMessage('Cada detalle requiere "tipo_venta"')
        .bail()
        .isString().withMessage('"tipo_venta" debe ser texto')
        .notEmpty().withMessage('"tipo_venta" no puede estar vacio'),
    body('detalles.*.cantidad')
        .if(body('detalles').exists())
        .exists().withMessage('Cada detalle requiere "cantidad"')
        .bail()
        .isInt({ gt: 0 }).withMessage('"cantidad" debe ser un entero mayor a 0'),
    body('detalles.*.valor_unitario')
        .if(body('detalles').exists())
        .exists().withMessage('Cada detalle requiere "valor_unitario"')
        .bail()
        .isFloat({ min: 0 }).withMessage('"valor_unitario" debe ser numerico y >= 0'),
    body('detalles.*.id_producto')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_producto" debe ser numerico y mayor a 0'),
    body('detalles.*.id_membresia')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_membresia" debe ser numerico y mayor a 0'),
    body('detalles.*.id_servicio')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_servicio" debe ser numerico y mayor a 0'),
    body('detalles.*.id_relacion')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_relacion" (beneficiario) debe ser numerico y mayor a 0')
        .bail()
        .custom(async (value) => {
            await ensureUsuarioExists(value);
        }),
    body('detalles.*.id_estado_membresia')
        .if(body('detalles').exists())
        .optional({ nullable: true })
        .isInt({ gt: 0 }).withMessage('"id_estado_membresia" debe ser numerico y mayor a 0'),
    body('detalles.*.perdidas_o_ganancias')
        .if(body('detalles').exists())
        .exists().withMessage('"perdidas_o_ganancias" es requerido')
        .bail()
        .isFloat().withMessage('"perdidas_o_ganancias" debe ser numerico')
];

const validateVentaCreate = [
    normalizeVentaUsuarioForCreate,
    body('id_usuario')
        .exists().withMessage('El campo "id_usuario" es requerido')
        .bail()
        .isInt({ gt: 0 }).withMessage('"id_usuario" debe ser un entero positivo')
        .bail()
        .custom(ensureUsuarioExists),
    body('fecha_venta')
        .optional()
        .isISO8601().withMessage('"fecha_venta" debe ser una fecha valida (YYYY-MM-DD)'),
    body('id_estado')
        .optional()
        .isInt({ gt: 0 }).withMessage('"id_estado" debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    body('plazo_maximo')
        .optional({ nullable: true })
        .isISO8601().withMessage('"plazo_maximo" debe ser una fecha valida (YYYY-MM-DD)'),
    body('plazoMaximo')
        .optional({ nullable: true })
        .isISO8601().withMessage('"plazoMaximo" debe ser una fecha valida (YYYY-MM-DD)'),
    body('valor_total_venta')
        .optional()
        .isFloat({ min: 0 }).withMessage('"valor_total_venta" debe ser numerico y >= 0'),
    ...detalleCreateRules,
    handleValidationResult
];

const validateVentaUpdate = [
    normalizeVentaUsuarioForUpdate,
    param('id')
        .isInt({ gt: 0 }).withMessage('El parametro "id" debe ser numerico'),
    body('id_usuario')
        .optional()
        .isInt({ gt: 0 }).withMessage('"id_usuario" debe ser un entero positivo')
        .bail()
        .custom(ensureUsuarioExists),
    body('fecha_venta')
        .optional()
        .isISO8601().withMessage('"fecha_venta" debe ser una fecha valida (YYYY-MM-DD)'),
    body('id_estado')
        .optional()
        .isInt({ gt: 0 }).withMessage('"id_estado" debe ser un entero positivo')
        .bail()
        .custom(ensureEstadoExists),
    body('plazo_maximo')
        .optional({ nullable: true })
        .isISO8601().withMessage('"plazo_maximo" debe ser una fecha valida (YYYY-MM-DD)'),
    body('plazoMaximo')
        .optional({ nullable: true })
        .isISO8601().withMessage('"plazoMaximo" debe ser una fecha valida (YYYY-MM-DD)'),
    body('valor_total_venta')
        .optional()
        .isFloat({ min: 0 }).withMessage('"valor_total_venta" debe ser numerico y >= 0'),
    ...detalleUpdateRules,
    handleValidationResult
];

module.exports = {
    validateVentaCreate,
    validateVentaUpdate
};
