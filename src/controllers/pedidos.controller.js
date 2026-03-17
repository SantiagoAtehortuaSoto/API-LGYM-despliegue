const {
    createDetallePedido,
    getDetallesPedidos,
    getDetallePedidoById,
    updateDetallePedido,
    deleteDetallePedido
} = require('./detalles_pedidos.controller');

// Mantiene compatibilidad legacy para /pedidos reutilizando la misma logica de /detalles_pedidos.
module.exports = {
    createPedido: createDetallePedido,
    getPedidos: getDetallesPedidos,
    getPedidoById: getDetallePedidoById,
    updatePedido: updateDetallePedido,
    deletePedido: deleteDetallePedido
};
