const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const EMPLEADO_INCLUDE = [
    {
        model: models.usuarios,
        as: 'id_usuario_usuario',
        attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email']
    }
];

const sanitizeEmpleadoPayload = (body = {}) => {
    const payload = {};
    if (body.id_usuario !== undefined) payload.id_usuario = body.id_usuario;
    if (body.direccion_empleado !== undefined) payload.direccion_empleado = body.direccion_empleado;
    if (body.cargo !== undefined) payload.cargo = body.cargo;
    if (body.fecha_contratacion !== undefined) payload.fecha_contratacion = body.fecha_contratacion;
    if (body.salario !== undefined) payload.salario = body.salario;
    if (body.horario_empleado !== undefined) payload.horario_empleado = body.horario_empleado;
    return payload;
};

const handleEmpleadoError = (res, method, error, message) => {
    console.error(`[Empleados][${method}]`, error);
    if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
            message: 'El usuario ya tiene un registro de empleado asignado'
        });
    }
    return res.status(500).json({ message });
};

const listEmpleados = async (req, res) => {
    try {
        const empleados = await paginateModel(models.empleados, req, {
            additionalSearchFields: [
                'id_usuario_usuario.nombre_usuario',
                'id_usuario_usuario.apellido_usuario',
                'id_usuario_usuario.email'
            ],
            include: EMPLEADO_INCLUDE,
            order: [['id_empleado', 'ASC']]
        });
        return res.status(200).json(empleados);
    } catch (error) {
        return handleEmpleadoError(
            res,
            'listEmpleados',
            error,
            'Error al obtener empleados'
        );
    }
};

const getEmpleadoById = (req, res) => {
    return res.status(200).json(req.empleado);
};

const createEmpleado = async (req, res) => {
    try {
        const payload = sanitizeEmpleadoPayload(req.body);
        const empleado = await models.empleados.create(payload);
        return res.status(201).json(empleado);
    } catch (error) {
        return handleEmpleadoError(
            res,
            'createEmpleado',
            error,
            'Error al crear empleado'
        );
    }
};

const updateEmpleado = async (req, res) => {
    try {
        const payload = sanitizeEmpleadoPayload(req.body);
        await req.empleado.update(payload);
        return res.status(200).json(req.empleado);
    } catch (error) {
        return handleEmpleadoError(
            res,
            'updateEmpleado',
            error,
            'Error al actualizar empleado'
        );
    }
};

const deleteEmpleado = async (req, res) => {
    try {
        await req.empleado.destroy();
        return res.status(200).json({ message: 'Empleado eliminado' });
    } catch (error) {
        return handleEmpleadoError(
            res,
            'deleteEmpleado',
            error,
            'Error al eliminar empleado'
        );
    }
};

module.exports = {
    listEmpleados,
    getEmpleadoById,
    createEmpleado,
    updateEmpleado,
    deleteEmpleado
};
