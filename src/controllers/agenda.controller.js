const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);

const ASISTENCIA_ESTADO = Object.freeze({
  PENDIENTE: 3,
  EN_PROCESO: 4,
  COMPLETADO: 5,
  CANCELADO: 6,
  NO_ASISTIO: 9
});

const toDateTime = (dateOnly, timeValue) => {
  if (!dateOnly || !timeValue) return null;
  const rawTime = String(timeValue).slice(0, 8);
  const normalizedTime = rawTime.length === 5 ? `${rawTime}:00` : rawTime;
  const parsed = new Date(`${dateOnly}T${normalizedTime}`);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const resolveAsistenciaEstadoId = ({ agendaFecha, horaInicio, horaFin, agendaEstadoId }) => {
  const agendaState = Number(agendaEstadoId);

  if (agendaState === ASISTENCIA_ESTADO.CANCELADO) {
    return ASISTENCIA_ESTADO.CANCELADO;
  }

  const now = new Date();
  const startAt = toDateTime(agendaFecha, horaInicio);
  const endAt = toDateTime(agendaFecha, horaFin);

  if (!startAt || !endAt) {
    return ASISTENCIA_ESTADO.PENDIENTE;
  }

  if (now < startAt) {
    return ASISTENCIA_ESTADO.PENDIENTE;
  }

  if (now <= endAt) {
    return ASISTENCIA_ESTADO.EN_PROCESO;
  }

  return agendaState === ASISTENCIA_ESTADO.COMPLETADO
    ? ASISTENCIA_ESTADO.COMPLETADO
    : ASISTENCIA_ESTADO.NO_ASISTIO;
};

const listAgendas = async (_req, res) => {
  try {
    const agendas = await models.agenda.findAll({
      include: [
        { model: models.usuarios, as: 'id_cliente_usuario', attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email'] },
        { model: models.usuarios, as: 'id_empleado_usuario', attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email'] },
        { model: models.estados, as: 'id_estado_estado', attributes: ['id_estado', 'estado'] }
      ]
    });
    res.status(200).json(agendas);
  } catch (error) {
    console.error('[Agenda] Error al listar agendas:', error);
    res.status(500).json({ message: 'Error al obtener la agenda', error: error.message });
  }
};

const listMyAgendas = async (req, res) => {
  try {
    const requesterId = Number(req.requesterId ?? req.user?.id);

    const agendas = await models.agenda.findAll({
      where: { id_cliente: requesterId },
      include: [
        { model: models.usuarios, as: 'id_cliente_usuario', attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email'] },
        { model: models.usuarios, as: 'id_empleado_usuario', attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email'] },
        { model: models.estados, as: 'id_estado_estado', attributes: ['id_estado', 'estado'] }
      ],
      order: [['agenda_fecha', 'ASC'], ['hora_inicio', 'ASC']]
    });

    return res.status(200).json(agendas);
  } catch (error) {
    console.error('[Agenda] Error al listar agenda del usuario autenticado:', error);
    return res.status(500).json({ message: 'Error al obtener la agenda del usuario', error: error.message });
  }
};

const getAgendaById = (req, res) => {
  if (!req.agenda) {
    return res.status(404).json({ message: 'Agenda no encontrada' });
  }
  return res.status(200).json(req.agenda);
};

const createAgenda = async (req, res) => {
  try {
    const nuevaAgenda = await sequelize.transaction(async (transaction) => {
      const createdAgenda = await models.agenda.create(req.body, { transaction });
      const asistenciaEstadoId = resolveAsistenciaEstadoId({
        agendaFecha: createdAgenda.agenda_fecha,
        horaInicio: createdAgenda.hora_inicio,
        horaFin: createdAgenda.hora_fin,
        agendaEstadoId: createdAgenda.id_estado
      });

      await models.asistencia_clientes.create(
        {
          id_agenda: createdAgenda.id_agenda,
          id_usuario: createdAgenda.id_cliente,
          fecha_asistencia: createdAgenda.agenda_fecha,
          hora_ingreso: createdAgenda.hora_inicio,
          hora_salida: null,
          id_estado: asistenciaEstadoId
        },
        { transaction }
      );

      return createdAgenda;
    });

    res.status(201).json(nuevaAgenda);
  } catch (error) {
    console.error('[Agenda] Error al crear agenda:', error);
    res.status(500).json({ message: 'Error al crear la agenda', error: error.message });
  }
};

const updateAgenda = async (req, res) => {
  try {
    await req.agenda.update(req.body);
    res.status(200).json(req.agenda);
  } catch (error) {
    console.error('[Agenda] Error al actualizar agenda:', error);
    res.status(500).json({ message: 'Error al actualizar la agenda', error: error.message });
  }
};

const deleteAgenda = async (req, res) => {
  try {
    await req.agenda.destroy();
    res.status(200).json({ message: 'Agenda eliminada' });
  } catch (error) {
    console.error('[Agenda] Error al eliminar agenda:', error);
    res.status(500).json({ message: 'Error al eliminar la agenda', error: error.message });
  }
};

module.exports = {
  listAgendas,
  listMyAgendas,
  getAgendaById,
  createAgenda,
  updateAgenda,
  deleteAgenda
};
