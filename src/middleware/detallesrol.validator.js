const { query } = require('express-validator');
const { validateResult } = require('./validator');

const normalizeDetallesRolListQuery = (req, _res, next) => {
    const rawQuery = req.query && typeof req.query === 'object' ? req.query : {};
    const filters = {};

    if (rawQuery.id_rol !== undefined) {
        filters.id_rol = Number(rawQuery.id_rol);
    }
    if (rawQuery.id_permiso !== undefined) {
        filters.id_permiso = Number(rawQuery.id_permiso);
    }
    if (rawQuery.id_privilegio !== undefined) {
        filters.id_privilegio = Number(rawQuery.id_privilegio);
    }
    if (rawQuery.limit !== undefined) {
        req.detallesRolLimit = Number(rawQuery.limit);
    }
    if (rawQuery.offset !== undefined) {
        req.detallesRolOffset = Number(rawQuery.offset);
    }

    req.detallesRolFilters = filters;
    next();
};

const validateDetallesRolListQuery = [
    query('id_rol')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"id_rol" debe ser un entero positivo'),
    query('id_permiso')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"id_permiso" debe ser un entero positivo'),
    query('id_privilegio')
        .optional()
        .isInt({ min: 1 })
        .withMessage('"id_privilegio" debe ser un entero positivo'),
    query('limit')
        .optional()
        .isInt({ min: 1, max: 500 })
        .withMessage('"limit" debe ser un entero entre 1 y 500'),
    query('offset')
        .optional()
        .isInt({ min: 0 })
        .withMessage('"offset" debe ser un entero mayor o igual a 0'),
    validateResult,
    normalizeDetallesRolListQuery
];

module.exports = {
    validateDetallesRolListQuery
};
