const initModels = require('../models/init-models');
const sequelize = require('../database');
const { Op } = require('sequelize');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);
const ESTADO_PEDIDO_PENDIENTE_ID = 3;

const PROVEEDOR_INCLUDE = [
    {
        model: models.estados,
        as: 'id_estado_estado',
        attributes: ['id_estado', 'estado']
    }
];

const sanitizeProveedorPayload = (body = {}) => {
    const payload = {};
    if (body.nit_proveedor !== undefined) payload.nit_proveedor = body.nit_proveedor;
    if (body.nombre_proveedor !== undefined) payload.nombre_proveedor = body.nombre_proveedor;
    if (body.telefono_proveedor !== undefined) payload.telefono_proveedor = body.telefono_proveedor;
    if (body.nombre_contacto !== undefined) payload.nombre_contacto = body.nombre_contacto;
    if (body.email_proveedor !== undefined) payload.email_proveedor = body.email_proveedor;
    if (body.direccion_proveedor !== undefined) payload.direccion_proveedor = body.direccion_proveedor;
    if (body.ciudad_proveedor !== undefined) payload.ciudad_proveedor = body.ciudad_proveedor;
    if (body.fecha_registro !== undefined) payload.fecha_registro = body.fecha_registro;
    if (body.id_estado !== undefined) payload.id_estado = body.id_estado;
    return payload;
};

const handleProveedorError = (res, method, error, fallbackMessage) => {
    console.error(`[Proveedores][${method}]`, error);
    if (error?.name === 'SequelizeUniqueConstraintError') {
        return res.status(400).json({
            message: 'El NIT ya esta registrado'
        });
    }
    return res.status(500).json({ message: fallbackMessage });
};

const getProveedores = async (req, res) => {
    try {
        const proveedores = await paginateModel(models.proveedores, req, {
            additionalSearchFields: ['id_estado_estado.estado'],
            include: PROVEEDOR_INCLUDE,
            order: [['id_proveedor', 'ASC']]
        });
        return res.status(200).json(proveedores);
    } catch (error) {
        return handleProveedorError(
            res,
            'getProveedores',
            error,
            'Error al obtener proveedores'
        );
    }
};

const getProveedorById = async (req, res) => {
    try {
        const proveedorId = req.proveedor?.id_proveedor || req.params.id;
        const proveedor = await models.proveedores.findByPk(proveedorId, {
            include: PROVEEDOR_INCLUDE
        });
        if (!proveedor) {
            return res.status(404).json({ message: 'Proveedor no encontrado' });
        }
        return res.status(200).json(proveedor);
    } catch (error) {
        return handleProveedorError(
            res,
            'getProveedorById',
            error,
            'Error al obtener proveedor'
        );
    }
};

const createProveedor = async (req, res) => {
    try {
        const payload = sanitizeProveedorPayload(req.body);
        const nuevoProveedor = await models.proveedores.create(payload);
        return res.status(201).json(nuevoProveedor);
    } catch (error) {
        return handleProveedorError(
            res,
            'createProveedor',
            error,
            'Error al crear proveedor'
        );
    }
};

const updateProveedor = async (req, res) => {
    try {
        const payload = sanitizeProveedorPayload(req.body);
        await req.proveedor.update(payload);
        return res.status(200).json(req.proveedor);
    } catch (error) {
        return handleProveedorError(
            res,
            'updateProveedor',
            error,
            'Error al actualizar proveedor'
        );
    }
};

const deleteProveedor = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const comprasRelacionadas = await models.compras.findAll({
            where: { id_proveedor: req.proveedor.id_proveedor },
            attributes: ['id_pedido', 'id_estado'],
            transaction,
            lock: transaction.LOCK.UPDATE
        });

        const comprasPendientes = comprasRelacionadas.filter(
            (compra) => Number(compra.id_estado) === ESTADO_PEDIDO_PENDIENTE_ID
        );
        if (comprasPendientes.length > 0) {
            await transaction.rollback();
            return res.status(409).json({
                message:
                    'No se puede eliminar el proveedor porque tiene pedidos pendientes (id_estado = 3).',
                detalles: {
                    pedidosPendientes: comprasPendientes.length
                }
            });
        }

        const comprasNoPendientesIds = comprasRelacionadas
            .filter((compra) => Number(compra.id_estado) !== ESTADO_PEDIDO_PENDIENTE_ID)
            .map((compra) => Number(compra.id_pedido))
            .filter((id) => Number.isInteger(id) && id > 0);

        if (comprasNoPendientesIds.length > 0) {
            await models.detalles_pedidos.destroy({
                where: { id_pedidos: { [Op.in]: comprasNoPendientesIds } },
                transaction
            });
            await models.compras.destroy({
                where: { id_pedido: { [Op.in]: comprasNoPendientesIds } },
                transaction
            });
        }

        await models.proveedores.destroy({
            where: { id_proveedor: req.proveedor.id_proveedor },
            transaction
        });

        await transaction.commit();
        return res.status(200).json({ message: 'Proveedor eliminado' });
    } catch (error) {
        await transaction.rollback();
        return handleProveedorError(
            res,
            'deleteProveedor',
            error,
            'Error al eliminar proveedor'
        );
    }
};

module.exports = {
    getProveedores,
    getProveedorById,
    createProveedor,
    updateProveedor,
    deleteProveedor
};
