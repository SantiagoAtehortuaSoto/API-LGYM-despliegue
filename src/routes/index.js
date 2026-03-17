const { Router } = require('express');
const router = Router();
const sequelize = require('../database');
const { QueryTypes } = require('sequelize');

router.get('/ping', async (req, res) => {
  try {
    const result = await sequelize.query('SELECT NOW() AS now', { type: QueryTypes.SELECT });
    res.status(200).json(result[0] || { now: null });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Error al conectar con la base de datos' });
  }
});

const routeModules = [
  ['/seguimiento_deportivo', './seguimiento_deportivo.routes'],
  ['/maestro_parametros', './maestro_parametros.routes'],
  ['/relacion_seguimiento_caracteristica', './relacion_seguimiento_caracteristica.routes'],
  ['/detalle_seguimiento', './detalle_seguimiento.routes'],
  ['/agenda', './agenda.routes'],
  ['/proveedores', './proveedores.routes'],
  ['/contactanos', './contactanos.routes'],
  ['/detalles_membresias', './detalles_membresias.routes'],
  ['/asistencia_clientes', './asistencia_clientes.routes'],
  ['/asistencia_empleado', './asistencia_empleado.routes'],
  ['/estados', './estados.routes'],
  ['/membresias', './membresias.routes'],
  ['/pedidos', './pedidos.routes'],
  ['/permisos', './permisos.routes'],
  ['/privilegios', './privilegios.routes'],
  ['/productos', './productos.routes'],
  ['/rol', './rol.routes'],
  ['/detallesrol', './detallesrol.routes'],
  ['/roles_usuarios', './roles_usuarios.routes'],
  ['/servicios', './servicios.routes'],
  ['/usuarios', './usuarios.routes'],
  ['/detalles_pedidos', './detalles_pedidos.routes'],
  ['/compras', './compras.routes'],
  ['/enviar-correo-proveedor', './enviar_correo_proveedor.routes'],
  ['/ventas', './ventas.routes'],
  ['/detalles_venta', './detalles_venta.routes'],
  ['/caracteristicas', './caracteristicas.routes'],
  ['/empleados', './empleados.routes'],
  ['/beneficiarios', './beneficiarios.routes'],
  ['/landing', './landing.routes']
];

routeModules.forEach(([path, modulePath]) => {
  router.use(path, require(modulePath));
});


module.exports = router;
