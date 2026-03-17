const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);

const DETALLE_INCLUDE = [
  {
    model: models.seguimiento_deportivo,
    as: 'id_seguimiento_seguimiento_deportivo',
    attributes: ['id_seguimiento', 'id_usuario', 'fecha_registro', 'actividad', 'deporte']
  },
  {
    model: models.relacion_seguimiento_caracteristica,
    as: 'relacion_seguimiento',
    include: [
      { model: models.maestro_parametros, as: 'id_maestro_p_maestro_parametro' },
      { model: models.caracteristicas, as: 'id_caracteristica_caracteristica' }
    ]
  }
];

const sanitizeDetallePayload = (body = {}) => {
  const payload = {};
  if (body.id_seguimiento !== undefined) payload.id_seguimiento = body.id_seguimiento;
  if (body.id_relacion_seguimiento !== undefined) payload.id_relacion_seguimiento = body.id_relacion_seguimiento;
  return payload;
};

const sanitizeDetalleResponse = (detalle = null) => {
  if (!detalle) return detalle;
  const plain = typeof detalle.get === 'function' ? detalle.get({ plain: true }) : { ...detalle };
  delete plain.valor_numerico;
  return plain;
};

const handleDetalleError = (res, method, error, message) => {
  console.error(`[DetalleSeguimiento][${method}]`, error);
  return res.status(500).json({ message });
};

const listDetallesSeguimiento = async (_req, res) => {
  try {
    const detalles = await models.detalle_seguimiento.findAll({
      include: DETALLE_INCLUDE
    });
    res.status(200).json(detalles.map(sanitizeDetalleResponse));
  } catch (error) {
    return handleDetalleError(res, 'listDetallesSeguimiento', error, 'Error al obtener detalles de seguimiento');
  }
};

const getDetalleSeguimientoById = (req, res) => {
  res.status(200).json(sanitizeDetalleResponse(req.detalleSeguimiento));
};

const createDetalleSeguimiento = async (req, res) => {
  try {
    const payload = sanitizeDetallePayload(req.body);
    const nuevoDetalle = await models.detalle_seguimiento.create(payload);
    res.status(201).json(sanitizeDetalleResponse(nuevoDetalle));
  } catch (error) {
    return handleDetalleError(res, 'createDetalleSeguimiento', error, 'Error al crear detalle de seguimiento');
  }
};

const updateDetalleSeguimiento = async (req, res) => {
  try {
    const payload = sanitizeDetallePayload(req.body);
    await req.detalleSeguimiento.update(payload);
    res.status(200).json(sanitizeDetalleResponse(req.detalleSeguimiento));
  } catch (error) {
    return handleDetalleError(res, 'updateDetalleSeguimiento', error, 'Error al actualizar detalle de seguimiento');
  }
};

const deleteDetalleSeguimiento = async (req, res) => {
  try {
    await req.detalleSeguimiento.destroy();
    res.status(200).json({ message: 'Detalle de seguimiento eliminado' });
  } catch (error) {
    return handleDetalleError(res, 'deleteDetalleSeguimiento', error, 'Error al eliminar detalle de seguimiento');
  }
};

module.exports = {
  listDetallesSeguimiento,
  getDetalleSeguimientoById,
  createDetalleSeguimiento,
  updateDetalleSeguimiento,
  deleteDetalleSeguimiento
};
