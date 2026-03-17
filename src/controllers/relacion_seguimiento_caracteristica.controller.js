const initModels = require('../models/init-models');
const sequelize = require('../database');

const models = initModels(sequelize);

const RELACION_INCLUDE = [
  { model: models.maestro_parametros, as: 'id_maestro_p_maestro_parametro' },
  { model: models.caracteristicas, as: 'id_caracteristica_caracteristica' }
];

const CONTROLLER_TAG = 'RelacionSeguimiento';

const sanitizeRelacionPayload = (body = {}) => {
  const payload = {};
  if (body.id_maestro_p !== undefined) payload.id_maestro_p = body.id_maestro_p;
  if (body.id_caracteristica !== undefined) payload.id_caracteristica = body.id_caracteristica;
  if (body.valor !== undefined) payload.valor = body.valor;
  if (body.observaciones !== undefined) payload.observaciones = body.observaciones;
  return payload;
};

const findRelacionWithInclude = async (id) =>
  models.relacion_seguimiento_caracteristica.findByPk(id, { include: RELACION_INCLUDE });

const handleRelacionError = (res, method, error, message) => {
  console.error(`[${CONTROLLER_TAG}][${method}]`, error);
  if (error?.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ message: 'La relacion ya existe con esos datos.' });
  }
  if (error?.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      message: 'El maestro_parametro o la caracteristica especificada no existe.'
    });
  }
  return res.status(500).json({ message });
};

const listRelaciones = async (_req, res) => {
  try {
    const relaciones = await models.relacion_seguimiento_caracteristica.findAll({
      include: RELACION_INCLUDE,
      order: [['id_relacion_seguimiento', 'ASC']]
    });
    return res.status(200).json(relaciones);
  } catch (error) {
    return handleRelacionError(
      res,
      'listRelaciones',
      error,
      'Error al obtener relaciones.'
    );
  }
};

const getRelacionById = async (req, res) => {
  try {
    const relacionId = req.relacionSeguimientoId || req.relacionSeguimiento?.id_relacion_seguimiento;
    const relacion = await findRelacionWithInclude(relacionId);
    if (!relacion) {
      return res.status(404).json({ message: 'Relacion no encontrada.' });
    }
    return res.status(200).json(relacion);
  } catch (error) {
    return handleRelacionError(
      res,
      'getRelacionById',
      error,
      'Error al obtener relacion.'
    );
  }
};

const createRelacion = async (req, res) => {
  try {
    const payload = sanitizeRelacionPayload(req.body);
    const nuevaRelacion = await models.relacion_seguimiento_caracteristica.create(payload);
    const relacionConInclude = await findRelacionWithInclude(nuevaRelacion.id_relacion_seguimiento);
    return res.status(201).json(relacionConInclude || nuevaRelacion);
  } catch (error) {
    return handleRelacionError(
      res,
      'createRelacion',
      error,
      'Error al crear relacion.'
    );
  }
};

const updateRelacion = async (req, res) => {
  try {
    const payload = sanitizeRelacionPayload(req.body);
    await req.relacionSeguimiento.update(payload);
    const relacionConInclude = await findRelacionWithInclude(req.relacionSeguimiento.id_relacion_seguimiento);
    return res.status(200).json(relacionConInclude || req.relacionSeguimiento);
  } catch (error) {
    return handleRelacionError(
      res,
      'updateRelacion',
      error,
      'Error al actualizar relacion.'
    );
  }
};

const deleteRelacion = async (req, res) => {
  try {
    const usosEnDetalle = await models.detalle_seguimiento.count({
      where: { id_relacion_seguimiento: req.relacionSeguimiento.id_relacion_seguimiento }
    });

    if (usosEnDetalle > 0) {
      return res.status(409).json({
        message: 'No se puede eliminar la relacion porque tiene registros de detalle asociados.'
      });
    }

    await req.relacionSeguimiento.destroy();
    return res.status(200).json({ message: 'Relacion eliminada.' });
  } catch (error) {
    return handleRelacionError(
      res,
      'deleteRelacion',
      error,
      'Error al eliminar relacion.'
    );
  }
};

module.exports = {
  listRelaciones,
  getRelacionById,
  createRelacion,
  updateRelacion,
  deleteRelacion
};
