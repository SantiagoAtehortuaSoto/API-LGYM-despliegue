const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const sanitizeMaestroParametroPayload = (body = {}) => {
  const payload = {};
  if (body.parametro !== undefined) payload.parametro = body.parametro;
  return payload;
};

const handleMaestroParametroError = (res, method, error, message) => {
  console.error(`[MaestroParametros][${method}]`, error);
  return res.status(500).json({ message });
};

const listMaestroParametros = async (req, res) => {
  try {
    const parametros = await paginateModel(models.maestro_parametros, req, {
      order: [['id_parametros_s', 'ASC']]
    });
    return res.status(200).json(parametros);
  } catch (error) {
    return handleMaestroParametroError(
      res,
      'listMaestroParametros',
      error,
      'Error al obtener maestro_parametros'
    );
  }
};

const getMaestroParametroById = (req, res) => {
  return res.status(200).json(req.maestroParametro);
};

const createMaestroParametro = async (req, res) => {
  try {
    const payload = sanitizeMaestroParametroPayload(req.body);
    const nuevoParametro = await models.maestro_parametros.create(payload);
    return res.status(201).json(nuevoParametro);
  } catch (error) {
    return handleMaestroParametroError(
      res,
      'createMaestroParametro',
      error,
      'Error al crear maestro_parametro'
    );
  }
};

const updateMaestroParametro = async (req, res) => {
  try {
    const payload = sanitizeMaestroParametroPayload(req.body);
    await req.maestroParametro.update(payload);
    return res.status(200).json(req.maestroParametro);
  } catch (error) {
    return handleMaestroParametroError(
      res,
      'updateMaestroParametro',
      error,
      'Error al actualizar maestro_parametro'
    );
  }
};

const deleteMaestroParametro = async (req, res) => {
  try {
    await req.maestroParametro.destroy();
    return res.status(200).json({ message: 'Parametro eliminado' });
  } catch (error) {
    return handleMaestroParametroError(
      res,
      'deleteMaestroParametro',
      error,
      'Error al eliminar maestro_parametro'
    );
  }
};

module.exports = {
  listMaestroParametros,
  getMaestroParametroById,
  createMaestroParametro,
  updateMaestroParametro,
  deleteMaestroParametro
};
