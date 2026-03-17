const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const sanitizeProductPayload = (body = {}) => {
    const payload = {};
    if (body.nombre_producto !== undefined) payload.nombre_producto = body.nombre_producto;
    if (body.categoria !== undefined) payload.categoria = body.categoria;
    if (body.descripcion_producto !== undefined) payload.descripcion_producto = body.descripcion_producto;
    if (body.precio_venta_producto !== undefined) payload.precio_venta_producto = body.precio_venta_producto;
    if (body.stock !== undefined) payload.stock = body.stock;
    if (body.id_estados !== undefined) payload.id_estados = body.id_estados;
    if (body.imagen_url !== undefined) payload.imagen_url = body.imagen_url;
    return payload;
};

const handleProductError = (res, method, error, fallbackMessage) => {
    console.error(`[Productos][${method}]`, error);
    return res.status(500).json({ message: fallbackMessage });
};

const getProducts = async (req, res) => {
    try {
        const products = await paginateModel(models.productos, req, {
            order: [['id_productos', 'ASC']]
        });
        return res.status(200).json(products);
    } catch (error) {
        return handleProductError(
            res,
            'getProducts',
            error,
            'Error al obtener productos'
        );
    }
};

const getProductById = (req, res) => {
    return res.status(200).json(req.product);
};

const createProduct = async (req, res) => {
    try {
        const payload = sanitizeProductPayload(req.body);
        const newProduct = await models.productos.create(payload);
        return res.status(201).json(newProduct);
    } catch (error) {
        return handleProductError(
            res,
            'createProduct',
            error,
            'Error al crear producto'
        );
    }
};

const updateProduct = async (req, res) => {
    try {
        const payload = sanitizeProductPayload(req.body);
        await req.product.update(payload);
        return res.status(200).json(req.product);
    } catch (error) {
        return handleProductError(
            res,
            'updateProduct',
            error,
            'Error al actualizar producto'
        );
    }
};

const deleteProduct = async (req, res) => {
    const productId = req.product.id_productos;
    try {
        const [ventasRelacionadas, pedidosRelacionados] = await Promise.all([
            models.detalles_venta.count({ where: { id_producto: productId } }),
            models.detalles_pedidos.count({ where: { id_productos: productId } })
        ]);

        if (ventasRelacionadas > 0 || pedidosRelacionados > 0) {
            return res.status(409).json({
                message: 'No se puede eliminar el producto porque esta asociado a ventas o pedidos.',
                detalles: {
                    ventasRelacionadas,
                    pedidosRelacionados
                }
            });
        }

        await req.product.destroy();
        return res.status(200).json({ message: 'Producto eliminado' });
    } catch (error) {
        return handleProductError(
            res,
            'deleteProduct',
            error,
            'Error al eliminar producto'
        );
    }
};

module.exports = {
    getProducts,
    getProductById,
    createProduct,
    updateProduct,
    deleteProduct
};
