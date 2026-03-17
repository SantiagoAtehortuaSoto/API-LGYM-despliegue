const initModels = require('../models/init-models');
const db = require('../database');
const { paginateModel } = require('../utils/pagination');
const models = initModels(db);

const CONTROLLER_TAG = 'AsistenciaClientes';

const ASISTENCIA_INCLUDE = [
  {
    model: models.agenda,
    as: 'id_agenda_agenda',
    attributes: ['id_agenda', 'agenda_fecha', 'hora_inicio', 'hora_fin', 'actividad_agenda']
  },
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
];

const findAsistenciaWithInclude = async (id) =>
  models.asistencia_clientes.findByPk(id, { include: ASISTENCIA_INCLUDE });

const handleAsistenciaError = (res, method, error, fallbackMessage) => {
  console.error(`[${CONTROLLER_TAG}][${method}]`, error);
  if (error?.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({
      message: 'La agenda, el usuario o el estado especificado no existe.'
    });
  }
  return res.status(500).json({ message: fallbackMessage });
};

const listAsistenciaClientes = async (req, res) => {
  try {
    const asistencias = await paginateModel(models.asistencia_clientes, req, {
      additionalSearchFields: [
        'id_agenda_agenda.agenda_fecha',
        'id_agenda_agenda.hora_inicio',
        'id_agenda_agenda.hora_fin',
        'id_agenda_agenda.actividad_agenda',
        'id_usuario_usuario.nombre_usuario',
        'id_usuario_usuario.apellido_usuario',
        'id_usuario_usuario.email',
        'id_estado_estado.estado'
      ],
      include: ASISTENCIA_INCLUDE,
      order: [['id_asistencia_clientes', 'ASC']]
    });
    return res.status(200).json(asistencias);
  } catch (error) {
    return handleAsistenciaError(
      res,
      'listAsistenciaClientes',
      error,
      'Error al obtener asistencias.'
    );
  }
};

const getAsistenciaClienteById = async (req, res) => {
  try {
    const asistenciaId =
      req.asistenciaClienteId || req.asistenciaCliente?.id_asistencia_clientes;
    const asistencia = await findAsistenciaWithInclude(asistenciaId);
    if (!asistencia) {
      return res.status(404).json({ message: 'Asistencia no encontrada.' });
    }
    return res.status(200).json(asistencia);
  } catch (error) {
    return handleAsistenciaError(
      res,
      'getAsistenciaClienteById',
      error,
      'Error al obtener asistencia.'
    );
  }
};

const createAsistenciaCliente = async (req, res) => {
  try {
    const payload = req.asistenciaClientePayload || req.body;
    const asistencia = await models.asistencia_clientes.create(payload);
    const asistenciaConInclude = await findAsistenciaWithInclude(asistencia.id_asistencia_clientes);
    return res.status(201).json(asistenciaConInclude || asistencia);
  } catch (error) {
    return handleAsistenciaError(
      res,
      'createAsistenciaCliente',
      error,
      'Error al crear asistencia.'
    );
  }
};

const updateAsistenciaCliente = async (req, res) => {
  try {
    const payload = req.asistenciaClientePayload || req.body;
    await req.asistenciaCliente.update(payload);
    const asistenciaConInclude = await findAsistenciaWithInclude(req.asistenciaCliente.id_asistencia_clientes);
    return res.status(200).json(asistenciaConInclude || req.asistenciaCliente);
  } catch (error) {
    return handleAsistenciaError(
      res,
      'updateAsistenciaCliente',
      error,
      'Error al actualizar asistencia.'
    );
  }
};

const deleteAsistenciaCliente = async (req, res) => {
  try {
    await req.asistenciaCliente.destroy();
    return res.status(200).json({ message: 'Asistencia eliminada.' });
  } catch (error) {
    return handleAsistenciaError(
      res,
      'deleteAsistenciaCliente',
      error,
      'Error al eliminar asistencia.'
    );
  }
};

module.exports = {
  listAsistenciaClientes,
  getAsistenciaClienteById,
  createAsistenciaCliente,
  updateAsistenciaCliente,
  deleteAsistenciaCliente
};
