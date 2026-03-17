const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');
const models = initModels(sequelize);

// Obtener todos los servicios
const getServicios = async (req, res) => {
     try {
         const servicios = await paginateModel(models.servicios, req, {
            order: [['id_servicio', 'ASC']]
         });
         res.status(200).json(servicios);
     } catch (error) {
        console.error('Error in getServicios:', error);
         res.status(500).json({ message: error.message });
     }
 };

// Obtener un servicio por ID
const getServicioById = async (req, res) => {
    try {
        const servicio = await models.servicios.findByPk(req.params.id);
        if (servicio) {
            res.json(servicio);
        } else {
            res.status(404).json({ message: 'Servicio no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Crear un nuevo servicio
const createServicio = async (req, res) => {
    try {
        const newServicio = await models.servicios.create(req.body);
        res.status(201).json(newServicio);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Actualizar un servicio
const updateServicio = async (req, res) => {
    try {
        const servicio = await models.servicios.findByPk(req.params.id);
        if (servicio) {
            await servicio.update(req.body);
            res.json(servicio);
        } else {
            res.status(404).json({ message: 'Servicio no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// Eliminar un servicio
const deleteServicio = async (req, res) => {
    try {
        const servicio = await models.servicios.findByPk(req.params.id);
        if (servicio) {
            await servicio.destroy();
            res.json({ message: 'Servicio eliminado' });
        } else {
            res.status(404).json({ message: 'Servicio no encontrado' });
        }
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getServicios,
    getServicioById,
    createServicio,
    updateServicio,
    deleteServicio
};
