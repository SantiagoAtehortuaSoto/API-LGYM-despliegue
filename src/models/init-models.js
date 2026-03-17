var DataTypes = require("sequelize").DataTypes;
var _agenda = require("./agenda");
var _asistencia_clientes = require("./asistencia_clientes");
var _asistencia_empleado = require("./asistencia_empleado");
var _caracteristicas = require("./caracteristicas");
var _compras = require("./compras");
var _detalle_seguimiento = require("./detalle_seguimiento");
var _detalles_cliente_beneficiarios = require("./detalles_cliente_beneficiarios");
var _detalles_detalles = require("./detalles_detalles");
var _detalles_membresias = require("./detalles_membresias");
var _detalles_pedidos = require("./detalles_pedidos");
var _detalles_venta = require("./detalles_venta");
var _detallesrol = require("./detallesrol");
var _empleados = require("./empleados");
var _estados = require("./estados");
var _maestro_parametros = require("./maestro_parametros");
var _membresias = require("./membresias");
var _pedidos_clientes = require("./pedidos_clientes");
var _permisos = require("./permisos");
var _privilegios = require("./privilegios");
var _productos = require("./productos");
var _proveedores = require("./proveedores");
var _relacion_seguimiento_caracteristica = require("./relacion_seguimiento_caracteristica");
var _rol = require("./rol");
var _roles_usuarios = require("./roles_usuarios");
var _seguimiento_deportivo = require("./seguimiento_deportivo");
var _servicios = require("./servicios");
var _usuarios = require("./usuarios");
var _password_resets = require("./password_resets");

function initModels(sequelize) {
  var agenda = _agenda(sequelize, DataTypes);
  var asistencia_clientes = _asistencia_clientes(sequelize, DataTypes);
  var asistencia_empleado = _asistencia_empleado(sequelize, DataTypes);
  var caracteristicas = _caracteristicas(sequelize, DataTypes);
  var compras = _compras(sequelize, DataTypes);
  var detalle_seguimiento = _detalle_seguimiento(sequelize, DataTypes);
  var detalles_cliente_beneficiarios = _detalles_cliente_beneficiarios(sequelize, DataTypes);
  var detalles_detalles = _detalles_detalles(sequelize, DataTypes);
  var detalles_membresias = _detalles_membresias(sequelize, DataTypes);
  var detalles_pedidos = _detalles_pedidos(sequelize, DataTypes);
  var detalles_venta = _detalles_venta(sequelize, DataTypes);
  var detallesrol = _detallesrol(sequelize, DataTypes);
  var empleados = _empleados(sequelize, DataTypes);
  var estados = _estados(sequelize, DataTypes);
  var maestro_parametros = _maestro_parametros(sequelize, DataTypes);
  var membresias = _membresias(sequelize, DataTypes);
  var pedidos_clientes = _pedidos_clientes(sequelize, DataTypes);
  var permisos = _permisos(sequelize, DataTypes);
  var privilegios = _privilegios(sequelize, DataTypes);
  var productos = _productos(sequelize, DataTypes);
  var proveedores = _proveedores(sequelize, DataTypes);
  var relacion_seguimiento_caracteristica = _relacion_seguimiento_caracteristica(sequelize, DataTypes);
  var rol = _rol(sequelize, DataTypes);
  var roles_usuarios = _roles_usuarios(sequelize, DataTypes);
  var seguimiento_deportivo = _seguimiento_deportivo(sequelize, DataTypes);
  var servicios = _servicios(sequelize, DataTypes);
  var usuarios = _usuarios(sequelize, DataTypes);
  var password_resets = _password_resets(sequelize, DataTypes);

  relacion_seguimiento_caracteristica.belongsTo(caracteristicas, { as: "id_caracteristica_caracteristica", foreignKey: "id_caracteristica"});
  caracteristicas.hasMany(relacion_seguimiento_caracteristica, { as: "relacion_seguimiento_caracteristicas", foreignKey: "id_caracteristica"});
  asistencia_clientes.belongsTo(agenda, { as: "id_agenda_agenda", foreignKey: "id_agenda"});
  agenda.hasMany(asistencia_clientes, { as: "asistencia_clientes", foreignKey: "id_agenda"});
  detalles_pedidos.belongsTo(compras, { as: "id_pedidos_compra", foreignKey: "id_pedidos"});
  compras.hasMany(detalles_pedidos, { as: "detalles_pedidos", foreignKey: "id_pedidos"});
  detalles_detalles.belongsTo(detalles_venta, { as: "id_detalle_detalles_ventum", foreignKey: "id_detalle"});
  detalles_venta.hasMany(detalles_detalles, { as: "detalles_detalles", foreignKey: "id_detalle"});
  agenda.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(agenda, { as: "agendas", foreignKey: "id_estado"});
  asistencia_clientes.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(asistencia_clientes, { as: "asistencia_clientes", foreignKey: "id_estado"});
  asistencia_empleado.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(asistencia_empleado, { as: "asistencia_empleados", foreignKey: "id_estado"});
  compras.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(compras, { as: "compras", foreignKey: "id_estado"});
  detalles_detalles.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(detalles_detalles, { as: "detalles_detalles", foreignKey: "id_estado"});
  detalles_membresias.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(detalles_membresias, { as: "detalles_membresia", foreignKey: "id_estado"});
  membresias.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(membresias, { as: "membresia", foreignKey: "id_estado"});
  detalles_cliente_beneficiarios.belongsTo(estados, { as: "id_estado_membresia_estado", foreignKey: "id_estado_membresia"});
  estados.hasMany(detalles_cliente_beneficiarios, { as: "detalles_cliente_beneficiarios", foreignKey: "id_estado_membresia"});
  permisos.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(permisos, { as: "permisos", foreignKey: "id_estado"});
  privilegios.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(privilegios, { as: "privilegios", foreignKey: "id_estado"});
  productos.belongsTo(estados, { as: "id_estados_estado", foreignKey: "id_estados"});
  estados.hasMany(productos, { as: "productos", foreignKey: "id_estados"});
  proveedores.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(proveedores, { as: "proveedores", foreignKey: "id_estado"});
  rol.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(rol, { as: "rols", foreignKey: "id_estado"});
  servicios.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(servicios, { as: "servicios", foreignKey: "id_estado"});
  usuarios.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(usuarios, { as: "usuarios", foreignKey: "id_estado"});
  relacion_seguimiento_caracteristica.belongsTo(maestro_parametros, { as: "id_maestro_p_maestro_parametro", foreignKey: "id_maestro_p"});
  maestro_parametros.hasMany(relacion_seguimiento_caracteristica, { as: "relacion_seguimiento_caracteristicas", foreignKey: "id_maestro_p"});
  detalles_detalles.belongsTo(membresias, { as: "id_membresias_membresia", foreignKey: "id_membresias"});
  membresias.hasMany(detalles_detalles, { as: "detalles_detalles", foreignKey: "id_membresias"});
  detalles_membresias.belongsTo(membresias, { as: "id_membresia_membresia", foreignKey: "id_membresia"});
  membresias.hasMany(detalles_membresias, { as: "detalles_membresia", foreignKey: "id_membresia"});
  detalles_cliente_beneficiarios.belongsTo(membresias, { as: "id_membresia_membresia", foreignKey: "id_membresia"});
  membresias.hasMany(detalles_cliente_beneficiarios, { as: "detalles_cliente_beneficiarios", foreignKey: "id_membresia"});
  detalles_venta.belongsTo(pedidos_clientes, { as: "id_pedido_cliente_pedidos_cliente", foreignKey: "id_pedido_cliente"});
  pedidos_clientes.hasMany(detalles_venta, { as: "detalles_venta", foreignKey: "id_pedido_cliente"});
  detalles_venta.belongsTo(productos, { as: "producto", foreignKey: "id_producto"});
  productos.hasMany(detalles_venta, { as: "detalles_ventas_producto", foreignKey: "id_producto"});
  detalles_venta.belongsTo(membresias, { as: "membresia", foreignKey: "id_membresia"});
  membresias.hasMany(detalles_venta, { as: "detalles_ventas_membresia", foreignKey: "id_membresia"});
  detalles_venta.belongsTo(servicios, { as: "servicio", foreignKey: "id_servicio"});
  servicios.hasMany(detalles_venta, { as: "detalles_ventas_servicio", foreignKey: "id_servicio"});
  detallesrol.belongsTo(permisos, { as: "id_permiso_permiso", foreignKey: "id_permiso"});
  permisos.hasMany(detallesrol, { as: "detallesrols", foreignKey: "id_permiso"});
  detallesrol.belongsTo(privilegios, { as: "id_privilegio_privilegio", foreignKey: "id_privilegio"});
  privilegios.hasMany(detallesrol, { as: "detallesrols", foreignKey: "id_privilegio"});
  detalles_detalles.belongsTo(productos, { as: "id_producto_producto", foreignKey: "id_producto"});
  productos.hasMany(detalles_detalles, { as: "detalles_detalles", foreignKey: "id_producto"});
  detalles_pedidos.belongsTo(productos, { as: "id_productos_producto", foreignKey: "id_productos"});
  productos.hasMany(detalles_pedidos, { as: "detalles_pedidos", foreignKey: "id_productos"});
  compras.belongsTo(proveedores, { as: "id_proveedor_proveedore", foreignKey: "id_proveedor"});
  proveedores.hasMany(compras, { as: "compras", foreignKey: "id_proveedor"});
  detalle_seguimiento.belongsTo(relacion_seguimiento_caracteristica, { as: "relacion_seguimiento", foreignKey: "id_relacion_seguimiento"});
  relacion_seguimiento_caracteristica.hasMany(detalle_seguimiento, { as: "detalle_seguimientos", foreignKey: "id_relacion_seguimiento"});
  detallesrol.belongsTo(rol, { as: "id_rol_rol", foreignKey: "id_rol"});
  rol.hasMany(detallesrol, { as: "detallesrols", foreignKey: "id_rol"});
  roles_usuarios.belongsTo(rol, { as: "id_rol_rol", foreignKey: "id_rol"});
  rol.hasMany(roles_usuarios, { as: "roles_usuarios", foreignKey: "id_rol"});
  detalle_seguimiento.belongsTo(seguimiento_deportivo, { as: "id_seguimiento_seguimiento_deportivo", foreignKey: "id_seguimiento"});
  seguimiento_deportivo.hasMany(detalle_seguimiento, { as: "detalle_seguimientos", foreignKey: "id_seguimiento"});
  detalles_detalles.belongsTo(servicios, { as: "id_servicio_servicio", foreignKey: "id_servicio"});
  servicios.hasMany(detalles_detalles, { as: "detalles_detalles", foreignKey: "id_servicio"});
  detalles_membresias.belongsTo(servicios, { as: "id_servicio_servicio", foreignKey: "id_servicio"});
  servicios.hasMany(detalles_membresias, { as: "detalles_membresia", foreignKey: "id_servicio"});
  agenda.belongsTo(usuarios, { as: "id_cliente_usuario", foreignKey: "id_cliente"});
  usuarios.hasMany(agenda, { as: "agendas_cliente", foreignKey: "id_cliente"});
  agenda.belongsTo(usuarios, { as: "id_empleado_usuario", foreignKey: "id_empleado"});
  usuarios.hasMany(agenda, { as: "agendas_empleado", foreignKey: "id_empleado"});
  asistencia_clientes.belongsTo(usuarios, { as: "id_usuario_usuario", foreignKey: "id_usuario"});
  usuarios.hasMany(asistencia_clientes, { as: "asistencia_clientes", foreignKey: "id_usuario"});
  asistencia_empleado.belongsTo(usuarios, { as: "id_usuario_usuario", foreignKey: "id_usuario"});
  usuarios.hasMany(asistencia_empleado, { as: "asistencia_empleados", foreignKey: "id_usuario"});
  empleados.belongsTo(usuarios, { as: "id_usuario_usuario", foreignKey: "id_usuario"});
  usuarios.hasMany(empleados, { as: "empleados", foreignKey: "id_usuario"});
  pedidos_clientes.belongsTo(usuarios, { as: "id_usuario_usuario", foreignKey: "id_usuario"});
  usuarios.hasMany(pedidos_clientes, { as: "pedidos_clientes", foreignKey: "id_usuario"});
  pedidos_clientes.belongsTo(estados, { as: "id_estado_estado", foreignKey: "id_estado"});
  estados.hasMany(pedidos_clientes, { as: "pedidos_clientes_estado", foreignKey: "id_estado"});
  detalles_cliente_beneficiarios.belongsTo(usuarios, { as: "id_usuario_usuario", foreignKey: "id_usuario"});
  usuarios.hasMany(detalles_cliente_beneficiarios, { as: "beneficiarios_propios", foreignKey: "id_usuario"});
  detalles_cliente_beneficiarios.belongsTo(usuarios, { as: "id_relacion_usuario", foreignKey: "id_relacion"});
  usuarios.hasMany(detalles_cliente_beneficiarios, { as: "beneficiarios_relaciones", foreignKey: "id_relacion"});
  roles_usuarios.belongsTo(usuarios, { as: "id_usuario_usuario", foreignKey: "id_usuario"});
  usuarios.hasMany(roles_usuarios, { as: "roles_usuarios", foreignKey: "id_usuario"});
  seguimiento_deportivo.belongsTo(usuarios, { as: "id_usuario_usuario", foreignKey: "id_usuario"});
  usuarios.hasMany(seguimiento_deportivo, { as: "seguimiento_deportivos", foreignKey: "id_usuario"});
  password_resets.belongsTo(usuarios, { as: "id_usuario_usuario", foreignKey: "id_usuario"});
  usuarios.hasMany(password_resets, { as: "password_resets", foreignKey: "id_usuario"});

  return {
    agenda,
    asistencia_clientes,
    asistencia_empleado,
    caracteristicas,
    compras,
    detalle_seguimiento,
    detalles_cliente_beneficiarios,
    detalles_detalles,
    detalles_membresias,
    detalles_pedidos,
    detalles_venta,
    detallesrol,
    empleados,
    estados,
    maestro_parametros,
    membresias,
    pedidos_clientes,
    permisos,
    privilegios,
    productos,
    proveedores,
    relacion_seguimiento_caracteristica,
    rol,
    roles_usuarios,
    seguimiento_deportivo,
    servicios,
    usuarios,
    password_resets,
  };
}
module.exports = initModels;
module.exports.initModels = initModels;
module.exports.default = initModels;
