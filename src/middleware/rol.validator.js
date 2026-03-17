const { check, param } = require('express-validator');
const { validateResult } = require('./validator');
const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const extractPermisosInput = (body = {}) => {
    if (!body || typeof body !== 'object') {
        return undefined;
    }

    if (body.permisos !== undefined) {
        return body.permisos;
    }

    if (body.asociaciones !== undefined) {
        return body.asociaciones;
    }

    const hasFlatInput =
        body.id_permiso !== undefined ||
        body.idPermiso !== undefined ||
        body.id_privilegio !== undefined ||
        body.idPrivilegio !== undefined ||
        body.privilegios !== undefined ||
        body.privilegio !== undefined;

    if (!hasFlatInput) {
        return undefined;
    }

    return [
        {
            id_permiso: body.id_permiso ?? body.idPermiso,
            id_privilegio: body.id_privilegio ?? body.idPrivilegio,
            privilegios: body.privilegios ?? body.privilegio
        }
    ];
};

const normalizePermisosPayload = (rawValue) => {
    if (rawValue === undefined) {
        return undefined;
    }

    const source = Array.isArray(rawValue) ? rawValue : [rawValue];
    if (!Array.isArray(source)) {
        return null;
    }

    const combos = [];
    const seen = new Set();

    for (const item of source) {
        if (!item || typeof item !== 'object') {
            return null;
        }

        const idPermiso = Number(item.id_permiso ?? item.idPermiso);
        if (!Number.isInteger(idPermiso) || idPermiso <= 0) {
            return null;
        }

        let privilegios = [];

        if (Array.isArray(item.privilegios)) {
            privilegios = item.privilegios.map((value) => Number(value));
        } else if (item.id_privilegio !== undefined && item.id_privilegio !== null) {
            privilegios = [Number(item.id_privilegio)];
        } else if (item.idPrivilegio !== undefined && item.idPrivilegio !== null) {
            privilegios = [Number(item.idPrivilegio)];
        } else if (item.privilegio !== undefined && item.privilegio !== null) {
            privilegios = [Number(item.privilegio)];
        } else {
            return null;
        }

        if (!privilegios.length || privilegios.some((id) => !Number.isInteger(id) || id <= 0)) {
            return null;
        }

        const uniquePrivilegios = [...new Set(privilegios)];

        for (const idPrivilegio of uniquePrivilegios) {
            const key = `${idPermiso}-${idPrivilegio}`;
            if (seen.has(key)) {
                continue;
            }
            seen.add(key);
            combos.push({
                id_permiso: idPermiso,
                id_privilegio: idPrivilegio
            });
        }
    }

    return combos;
};

const normalizeRolPayload = (req, _res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const normalized = {};

    const nombreRol = body.nombre_rol ?? body.nombreRol ?? body.nombre;
    if (nombreRol !== undefined && nombreRol !== null) {
        normalized.nombre_rol = String(nombreRol).trim();
    }

    const idEstado = body.id_estado ?? body.idEstado ?? body.estadoId;
    if (idEstado !== undefined && idEstado !== null && idEstado !== '') {
        const parsed = Number(idEstado);
        normalized.id_estado = Number.isNaN(parsed) ? idEstado : parsed;
    }

    const rawPermisos = extractPermisosInput(body);
    if (rawPermisos !== undefined) {
        normalized.permisos = rawPermisos;
    }

    req.body = normalized;
    next();
};

const ensureEstadoExists = async (idEstado) => {
    const estado = await models.estados.findByPk(idEstado, { attributes: ['id_estado'] });
    if (!estado) {
        throw new Error(`El id_estado '${idEstado}' no es valido.`);
    }
    return true;
};

const checkRolExists = [
    param('id')
        .isInt({ min: 1 })
        .withMessage('El parametro "id" debe ser numerico y mayor a 0')
        .bail()
        .custom(async (id, { req }) => {
            const rol = await models.rol.findByPk(id);
            if (!rol) {
                throw new Error('Rol no encontrado');
            }
            req.rol = rol;
            return true;
        }),
    validateResult
];

const parsePermisosPayload = ({ required = false } = {}) => (req, res, next) => {
    const rawPermisos = req.body.permisos;

    if (rawPermisos === undefined) {
        if (required) {
            return res.status(400).json({
                message:
                    'Debe proporcionar permisos como { permisos: [{ id_permiso, privilegios[]|id_privilegio }] } o en formato simple { id_permiso, id_privilegio }'
            });
        }
        req.hasPermisosInput = false;
        req.normalizedPermisos = undefined;
        return next();
    }

    const normalizedPermisos = normalizePermisosPayload(rawPermisos);
    if (normalizedPermisos === null) {
        return res.status(400).json({
            message:
                'El formato de permisos no es valido. Use { permisos: [{ id_permiso, privilegios[]|id_privilegio }] } o { id_permiso, id_privilegio }. Cada permiso requiere al menos un privilegio.'
        });
    }

    req.hasPermisosInput = true;
    req.normalizedPermisos = normalizedPermisos;
    return next();
};

const validateRolCreate = [
    check('nombre_rol')
        .exists({ checkNull: true })
        .withMessage('nombre_rol es requerido')
        .bail()
        .isString()
        .withMessage('nombre_rol debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('nombre_rol no puede estar vacio')
        .bail()
        .isLength({ max: 20 })
        .withMessage('nombre_rol no debe superar 20 caracteres'),
    check('id_estado')
        .optional()
        .isInt({ min: 1 })
        .withMessage('id_estado debe ser numerico y mayor a 0')
        .bail()
        .custom(ensureEstadoExists),
    validateResult,
    parsePermisosPayload({ required: false })
];

const validateRolUpdatePayload = (req, res, next) => {
    const hasAllowedField =
        req.body.nombre_rol !== undefined ||
        req.body.id_estado !== undefined ||
        req.hasPermisosInput;

    if (!hasAllowedField) {
        return res.status(400).json({
            message: 'Debes enviar al menos un campo valido para actualizar'
        });
    }

    return next();
};

const validateRolUpdate = [
    check('nombre_rol')
        .optional()
        .isString()
        .withMessage('nombre_rol debe ser texto')
        .bail()
        .notEmpty()
        .withMessage('nombre_rol no puede estar vacio')
        .bail()
        .isLength({ max: 20 })
        .withMessage('nombre_rol no debe superar 20 caracteres'),
    check('id_estado')
        .optional()
        .isInt({ min: 1 })
        .withMessage('id_estado debe ser numerico y mayor a 0')
        .bail()
        .custom(ensureEstadoExists),
    validateResult,
    parsePermisosPayload({ required: false }),
    validateRolUpdatePayload
];

const validateAssignPermissions = [parsePermisosPayload({ required: true })];

module.exports = {
    normalizeRolPayload,
    checkRolExists,
    validateRolCreate,
    validateRolUpdate,
    validateAssignPermissions
};
