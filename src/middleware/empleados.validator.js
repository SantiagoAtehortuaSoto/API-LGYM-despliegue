const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');
const { Op } = require('sequelize');

const models = initModels(sequelize);

const normalizeEmpleadoPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = {};

    const idUsuario = body.id_usuario ?? body.idUsuario ?? body.usuarioId ?? body.userId ?? body.id_user;
    if (idUsuario !== undefined && idUsuario !== null && idUsuario !== '') {
        const parsed = Number(idUsuario);
        normalized.id_usuario = Number.isNaN(parsed) ? idUsuario : parsed;
    }

    const direccion =
        body.direccion_empleado ??
        body.direccion ??
        body.address ??
        body.direccionEmpleado;
    if (direccion !== undefined && direccion !== null) {
        normalized.direccion_empleado = String(direccion).trim();
    }

    const cargo = body.cargo ?? body.puesto ?? body.rol;
    if (cargo !== undefined && cargo !== null) {
        normalized.cargo = String(cargo).trim();
    }

    const fechaContratacion =
        body.fecha_contratacion ??
        body.fechaContratacion ??
        body.fecha_contrato ??
        body.fechaContrato;
    if (fechaContratacion !== undefined && fechaContratacion !== null) {
        normalized.fecha_contratacion = String(fechaContratacion).trim();
    }

    const salario = body.salario ?? body.sueldo ?? body.salario_mensual;
    if (salario !== undefined && salario !== null && salario !== '') {
        const parsed = Number(salario);
        normalized.salario = Number.isNaN(parsed) ? salario : parsed;
    }

    const horario = body.horario_empleado ?? body.horario ?? body.turno;
    if (horario !== undefined && horario !== null) {
        normalized.horario_empleado = String(horario).trim();
    }

    req.body = normalized;
    next();
};

const ensureUsuarioExists = async (id_usuario) => {
    const usuario = await models.usuarios.findByPk(id_usuario, {
        attributes: ['id_usuario']
    });
    if (!usuario) {
        throw new Error('El usuario especificado no existe');
    }
};

const ensureUsuarioNoAsignado = async (id_usuario, currentEmpleadoId = null) => {
    const exists = await models.empleados.findOne({
        where: currentEmpleadoId
            ? { id_usuario, id_empleado: { [Op.ne]: currentEmpleadoId } }
            : { id_usuario },
        attributes: ['id_empleado']
    });

    if (exists) {
        throw new Error('El usuario ya tiene un registro de empleado asignado');
    }
};

const checkEmpleadoExists = [
    param('id')
        .isInt({ min: 1 }).withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const empleado = await models.empleados.findByPk(id);
            if (!empleado) {
                throw new Error('Empleado no encontrado');
            }
            req.empleado = empleado;
            return true;
        }),
    validateResult
];

const validateEmpleadoCreate = [
    check('id_usuario')
        .exists({ checkNull: true }).withMessage('El campo id_usuario es requerido')
        .bail()
        .isInt({ min: 1 }).withMessage('id_usuario debe ser numerico y mayor a 0')
        .bail()
        .custom(async (value) => {
            await ensureUsuarioExists(value);
            await ensureUsuarioNoAsignado(value);
        }),
    check('direccion_empleado')
        .exists({ checkNull: true }).withMessage('direccion_empleado es requerida')
        .bail()
        .isString().withMessage('direccion_empleado debe ser texto')
        .bail()
        .notEmpty().withMessage('direccion_empleado no puede estar vacia')
        .bail()
        .isLength({ max: 200 }).withMessage('direccion_empleado no debe superar 200 caracteres'),
    check('cargo')
        .optional()
        .isString().withMessage('cargo debe ser texto')
        .bail()
        .isLength({ max: 80 }).withMessage('cargo no debe superar 80 caracteres'),
    check('fecha_contratacion')
        .exists({ checkNull: true }).withMessage('fecha_contratacion es requerida')
        .bail()
        .isISO8601().withMessage('fecha_contratacion debe ser una fecha valida (YYYY-MM-DD)'),
    check('salario')
        .exists({ checkNull: true }).withMessage('salario es requerido')
        .bail()
        .isFloat({ min: 0 }).withMessage('salario debe ser numerico y mayor o igual a 0'),
    check('horario_empleado')
        .optional()
        .isString().withMessage('horario_empleado debe ser texto')
        .bail()
        .isLength({ max: 20 }).withMessage('horario_empleado no debe superar 20 caracteres'),
    validateResult
];

const validateEmpleadoUpdatePayload = (req, res, next) => {
    const hasAllowedField = [
        'id_usuario',
        'direccion_empleado',
        'cargo',
        'fecha_contratacion',
        'salario',
        'horario_empleado'
    ].some((field) => req.body[field] !== undefined);

    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }

    return next();
};

const validateEmpleadoUpdate = [
    param('id')
        .isInt({ min: 1 }).withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const empleado = await models.empleados.findByPk(id);
            if (!empleado) {
                throw new Error('Empleado no encontrado');
            }
            req.empleado = empleado;
            return true;
        }),
    check('id_usuario')
        .optional()
        .isInt({ min: 1 }).withMessage('id_usuario debe ser numerico y mayor a 0')
        .bail()
        .custom(async (value, { req }) => {
            await ensureUsuarioExists(value);
            await ensureUsuarioNoAsignado(value, req.empleado?.id_empleado);
        }),
    check('direccion_empleado')
        .optional()
        .isString().withMessage('direccion_empleado debe ser texto')
        .bail()
        .notEmpty().withMessage('direccion_empleado no puede estar vacia')
        .bail()
        .isLength({ max: 200 }).withMessage('direccion_empleado no debe superar 200 caracteres'),
    check('cargo')
        .optional()
        .isString().withMessage('cargo debe ser texto')
        .bail()
        .isLength({ max: 80 }).withMessage('cargo no debe superar 80 caracteres'),
    check('fecha_contratacion')
        .optional()
        .isISO8601().withMessage('fecha_contratacion debe ser una fecha valida (YYYY-MM-DD)'),
    check('salario')
        .optional()
        .isFloat({ min: 0 }).withMessage('salario debe ser numerico y mayor o igual a 0'),
    check('horario_empleado')
        .optional()
        .isString().withMessage('horario_empleado debe ser texto')
        .bail()
        .isLength({ max: 20 }).withMessage('horario_empleado no debe superar 20 caracteres'),
    validateResult,
    validateEmpleadoUpdatePayload
];

module.exports = {
    checkEmpleadoExists,
    normalizeEmpleadoPayload,
    validateEmpleadoCreate,
    validateEmpleadoUpdate
};
