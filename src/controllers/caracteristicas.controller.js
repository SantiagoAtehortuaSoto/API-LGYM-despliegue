const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');

const models = initModels(sequelize);

const listCaracteristicas = async (req, res) => {
  try {
    const caracteristicas = await paginateModel(models.caracteristicas, req, {
      order: [['id_caracteristicas', 'ASC']]
    });
    res.status(200).json(caracteristicas);
  } catch (error) {
    console.error('[Caracteristicas] Error al listar:', error);
    res.status(500).json({ message: 'Error al obtener las caracteristicas', error: error.message });
  }
};

const getCaracteristicaById = (req, res) => {
  res.status(200).json(req.caracteristica);
};

const createCaracteristica = async (req, res) => {
  try {
    const nueva = await models.caracteristicas.create(req.body);
    res.status(201).json(nueva);
  } catch (error) {
    console.error('[Caracteristicas] Error al crear:', error);
    res.status(500).json({ message: 'Error al crear la caracteristica', error: error.message });
  }
};

const updateCaracteristica = async (req, res) => {
  try {
    await req.caracteristica.update(req.body);
    res.status(200).json(req.caracteristica);
  } catch (error) {
    console.error('[Caracteristicas] Error al actualizar:', error);
    res.status(500).json({ message: 'Error al actualizar la caracteristica', error: error.message });
  }
};

const deleteCaracteristica = async (req, res) => {
  try {
    await req.caracteristica.destroy();
    res.status(200).json({ message: 'Caracteristica eliminada' });
  } catch (error) {
    console.error('[Caracteristicas] Error al eliminar:', error);
    res.status(500).json({ message: 'Error al eliminar la caracteristica', error: error.message });
  }
};

module.exports = {
  listCaracteristicas,
  getCaracteristicaById,
  createCaracteristica,
  updateCaracteristica,
  deleteCaracteristica
};
