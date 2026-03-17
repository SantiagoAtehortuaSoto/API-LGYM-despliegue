const {
    checkDetallesPedidosExists,
    validateDetallesPedidosCreate,
    validateDetallesPedidosUpdate
} = require('./detalles_pedidos.validator');

// Alias para conservar nomenclatura de /pedidos sin duplicar reglas.
module.exports = {
    checkPedidoExists: checkDetallesPedidosExists,
    validatePedidoCreate: validateDetallesPedidosCreate,
    validatePedidoUpdate: validateDetallesPedidosUpdate
};
