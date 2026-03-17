// Normaliza el payload del carrito de la landing para reutilizar createVenta
const normalizeLandingOrder = (req, res, next) => {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const hasValue = (value) => value !== undefined && value !== null && value !== '';
    const pickFirstValue = (...values) => values.find(hasValue);

    const idUsuario = pickFirstValue(
        body.id_usuario,
        body.idUsuario,
        body.usuarioId,
        body.userId,
        body.clienteId,
        body.cliente_id,
        body.id_cliente,
        body.idCliente,
        body.usuario?.id,
        body.usuario?.id_usuario,
        body.user?.id,
        body.cliente?.id,
        body.cliente?.id_usuario
    );

    if (!hasValue(idUsuario)) {
        return res.status(400).json({ message: 'id_usuario es requerido' });
    }

    const incomingDetalles = Array.isArray(body.detalles)
        ? body.detalles
        : Array.isArray(body.detalle_venta)
        ? body.detalle_venta
        : Array.isArray(body.detalles_venta)
        ? body.detalles_venta
        : null;
    const fallbackItems = Array.isArray(body.carrito)
        ? body.carrito
        : Array.isArray(body.items)
        ? body.items
        : [];
    const sourceItems = incomingDetalles && incomingDetalles.length ? incomingDetalles : fallbackItems;

    if (!sourceItems.length) {
        return res.status(400).json({ message: 'El carrito esta vacio' });
    }

    const mappedDetalles = sourceItems
        .map((item) => {
            const idGenerico = item.id ?? null;
            const tipoDeclarado = (item.tipo_venta ?? item.tipoVenta ?? item.tipo ?? '').toString().toUpperCase();

            let idProducto =
                item.id_producto ??
                item.idProducto ??
                item.productoId ??
                item.productId ??
                item.id_producto_carrito ??
                item.id_producto_venta ??
                item.idProductoVenta ??
                item.id_producto_carrito ??
                null;
            let idMembresia =
                item.id_membresia ??
                item.idMembresia ??
                item.membresiaId ??
                item.id_membresias ??
                item.idPlan ??
                item.planId ??
                null;
            let idServicio =
                item.id_servicio ??
                item.idServicio ??
                item.servicioId ??
                null;

            // Inferimos el id correcto si solo viene "id" y el tipo indica la categoria
            if (idGenerico !== null && idGenerico !== undefined) {
                if (!idMembresia && tipoDeclarado === 'MEMBRESIA') {
                    idMembresia = idGenerico;
                } else if (!idServicio && tipoDeclarado === 'SERVICIO') {
                    idServicio = idGenerico;
                } else if (!idProducto && (!tipoDeclarado || tipoDeclarado === 'PRODUCTO')) {
                    idProducto = idGenerico;
                }
            }

            const cantidadRaw = item.cantidad ?? item.qty ?? item.quantity ?? 1;
            const valorRaw =
                item.valor_unitario ??
                item.valorUnitario ??
                item.precio_unitario ??
                item.precioUnitario ??
                item.valor ??
                item.precio ??
                item.price ??
                item.unitPrice ??
                item.valor_venta ??
                0;
            const cantidad = Number(cantidadRaw);
            const valor = Number(valorRaw);
            const cantidadNormalizada = Number.isFinite(cantidad) && cantidad > 0 ? cantidad : 1;
            const valorNormalizado = Number.isFinite(valor) && valor >= 0 ? valor : 0;
            const subtotalRaw = item.subtotal ?? item.valor_total ?? item.total;
            const subtotalCalculado = Number((cantidadNormalizada * valorNormalizado).toFixed(2));
            const subtotal = Number.isFinite(Number(subtotalRaw)) ? Number(subtotalRaw) : subtotalCalculado;
            const perdidasRaw = item.perdidas_o_ganancias ?? item.perdidasGanancias;
            const perdidasOGanancias = Number.isFinite(Number(perdidasRaw)) ? Number(perdidasRaw) : subtotal;

            // Beneficiario (solo para membresias)
            const idRelacion =
                item.id_relacion ??
                item.idRelacion ??
                item.beneficiarioId ??
                item.beneficiario ??
                null;
            const idEstadoMembresia =
                item.id_estado_membresia ??
                item.idEstadoMembresia ??
                item.estadoMembresiaId ??
                item.estado_membresia ??
                null;

            const hasMembresia = idMembresia !== null && idMembresia !== undefined;
            const hasServicio = idServicio !== null && idServicio !== undefined && !hasMembresia;
            const hasProducto = idProducto !== null && idProducto !== undefined && !hasMembresia && !hasServicio;

            if (!hasMembresia && !hasProducto && !hasServicio) {
                return null;
            }

            const tipo_venta =
                tipoDeclarado ||
                item.tipo_venta ||
                item.tipo ||
                (hasMembresia ? 'MEMBRESIA' : hasServicio ? 'SERVICIO' : 'PRODUCTO');

            return {
                tipo_venta,
                cantidad: cantidadNormalizada,
                perdidas_o_ganancias: perdidasOGanancias,
                id_producto: hasProducto ? Number(idProducto) || idProducto : null,
                id_membresia: hasMembresia ? Number(idMembresia) || idMembresia : null,
                id_servicio: hasServicio ? Number(idServicio) || idServicio : null,
                valor_unitario: valorNormalizado,
                id_relacion: hasMembresia ? (Number(idRelacion) || idRelacion || null) : null,
                id_estado_membresia: hasMembresia
                    ? (idEstadoMembresia === null || idEstadoMembresia === undefined
                          ? null
                          : Number(idEstadoMembresia) || idEstadoMembresia)
                    : null
            };
        })
        .filter(Boolean);

    if (!mappedDetalles.length) {
        return res.status(400).json({ message: 'El carrito no tiene productos validos' });
    }

    const totalCalculado = mappedDetalles.reduce((acc, det) => acc + det.valor_unitario * det.cantidad, 0);
    const total = Number.isFinite(Number(body.valor_total_venta))
        ? Number(body.valor_total_venta)
        : Number(totalCalculado.toFixed(2));
    const estadoId =
        pickFirstValue(body.id_estado, body.estadoId, body.estado_id, body.estado, 3); // default PENDIENTE (id_estado = 3)

    req.body = {
        id_usuario: Number(idUsuario) || idUsuario,
        fecha_venta: body.fecha_venta ?? body.fecha ?? new Date().toISOString().split('T')[0],
        id_estado: estadoId !== null && estadoId !== undefined ? Number(estadoId) || estadoId : undefined,
        detalles: mappedDetalles,
        valor_total_venta: total
    };

    next();
};

module.exports = { normalizeLandingOrder };
