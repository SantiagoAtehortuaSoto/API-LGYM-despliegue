const initModels = require('../models/init-models');
const sequelize = require('../database');
const { paginateModel } = require('../utils/pagination');
const models = initModels(sequelize);

const listAsistenciaEmpleados = async (req, res) => {
  try {
    const asistencias = await paginateModel(models.asistencia_empleado, req, {
      additionalSearchFields: [
        'id_usuario_usuario.nombre_usuario',
        'id_usuario_usuario.apellido_usuario',
        'id_usuario_usuario.email',
        'id_estado_estado.estado'
      ],
      include: [
        {
          model: models.usuarios,
          as: 'id_usuario_usuario',
          attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email']
        },
        {
          model: models.estados,
          as: 'id_estado_estado',
          attributes: ['id_estado', 'estado']
        }
      ],
      order: [['id_asistencia_empleado', 'ASC']]
    });
    res.status(200).json(asistencias);
  } catch (error) {
    console.error('[AsistenciaEmpleado] Error al listar asistencias:', error);
    res.status(500).json({ message: 'Error al obtener asistencias', error: error.message });
  }
};

const getAsistenciaEmpleadoById = (req, res) => {
  res.status(200).json(req.asistenciaEmpleado);
};

const createAsistenciaEmpleado = async (req, res) => {
  try {
    const asistencia = await models.asistencia_empleado.create(req.body);
    res.status(201).json(asistencia);
  } catch (error) {
    console.error('[AsistenciaEmpleado] Error al crear asistencia:', error);
    res.status(500).json({ message: 'Error al crear asistencia', error: error.message });
  }
};

const updateAsistenciaEmpleado = async (req, res) => {
  try {
    await req.asistenciaEmpleado.update(req.body);
    res.status(200).json(req.asistenciaEmpleado);
  } catch (error) {
    console.error('[AsistenciaEmpleado] Error al actualizar asistencia:', error);
    res.status(500).json({ message: 'Error al actualizar asistencia', error: error.message });
  }
};

const deleteAsistenciaEmpleado = async (req, res) => {
  try {
    await req.asistenciaEmpleado.destroy();
    res.status(200).json({ message: 'Asistencia eliminada' });
  } catch (error) {
    console.error('[AsistenciaEmpleado] Error al eliminar asistencia:', error);
    res.status(500).json({ message: 'Error al eliminar asistencia', error: error.message });
  }
};

module.exports = {
  listAsistenciaEmpleados,
  getAsistenciaEmpleadoById,
  createAsistenciaEmpleado,
  updateAsistenciaEmpleado,
  deleteAsistenciaEmpleado
};
