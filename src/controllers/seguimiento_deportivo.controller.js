const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);

const detalleInclude = {
  model: models.detalle_seguimiento,
  as: 'detalle_seguimientos',
  include: [
    {
      model: models.relacion_seguimiento_caracteristica,
      as: 'relacion_seguimiento',
      include: [
        { model: models.caracteristicas, as: 'id_caracteristica_caracteristica' },
        { model: models.maestro_parametros, as: 'id_maestro_p_maestro_parametro' }
      ]
    }
  ]
};

const hasOwn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

const firstDefined = (...values) => values.find((value) => value !== undefined && value !== null);

const normalizeDetallesInput = (body = {}) => {
  const raw = firstDefined(
    body.detalles,
    body.detalle_seguimiento,
    body.detalleSeguimiento,
    body.detalle_seguimientos,
    body.detalles_seguimiento,
    body.detalle,
    body.relaciones,
    body.items
  );
  if (!raw) {
    const topLevelAliases = [
      'id_relacion_seguimiento',
      'id_relacion',
      'relacion_seguimiento_id',
      'id_relacion_seguimiento_caracteristica',
      'id_relacion_caracteristica',
      'id_maestro_p',
      'id_maestro',
      'id_parametros_s',
      'id_parametro',
      'maestro_parametro_id',
      'id_maestro_parametro',
      'id_caracteristica',
      'id_caracteristicas',
      'caracteristica_id',
      'id_caracteristica_s',
      'maestro_parametro',
      'parametro',
      'maestro',
      'nombre_parametro',
      'nombre_maestro',
      'caracteristica',
      'propiedad',
      'nombre_caracteristica',
      'nombre_propiedad',
      'valor',
      'value',
      'valor_numerico',
      'valor_relacion',
      'valorRelacion',
      'observaciones',
      'observacion',
      'nota',
      'notas'
    ];
    const hasTopLevelDetalle = topLevelAliases.some((alias) => hasOwn(body, alias));
    return hasTopLevelDetalle ? [body] : [];
  }
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (_error) {
      return [raw];
    }
  }
  if (typeof raw === 'object') {
    const nested = firstDefined(raw.detalles, raw.items, raw.relaciones);
    if (Array.isArray(nested)) return nested;
  }
  return [raw];
};

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const parseOptionalFloat = (value) => {
  if (value === undefined || value === null || value === '') return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
};

const normalizeText = (value) => (typeof value === 'string' ? value.trim() : '');

const getDetalleSources = (detalle = {}) => {
  const sources = [detalle];
  const nestedKeys = ['relacion', 'relacion_seguimiento', 'relacionSeguimiento'];
  for (const key of nestedKeys) {
    const nested = detalle?.[key];
    if (nested && typeof nested === 'object') {
      sources.push(nested);
    }
  }
  return sources;
};

const readDetalleField = (detalle = {}, aliases = []) => {
  for (const source of getDetalleSources(detalle)) {
    for (const alias of aliases) {
      const value = source?.[alias];
      if (value !== undefined && value !== null && value !== '') return value;
    }
  }
  return undefined;
};

const readDetalleFieldRaw = (detalle = {}, aliases = []) => {
  for (const source of getDetalleSources(detalle)) {
    for (const alias of aliases) {
      if (source && hasOwn(source, alias)) return source[alias];
    }
  }
  return undefined;
};

const hasDetalleField = (detalle = {}, aliases = []) => {
  for (const source of getDetalleSources(detalle)) {
    for (const alias of aliases) {
      if (source && hasOwn(source, alias)) return true;
    }
  }
  return false;
};

const parseOptionalObservation = (value) => {
  if (value === undefined) return { valid: true, value: undefined };
  if (value === null) return { valid: true, value: null };
  if (typeof value !== 'string') return { valid: false, value: null };
  const trimmed = value.trim();
  return { valid: true, value: trimmed === '' ? null : trimmed };
};

const sanitizeDetalle = (detalle = {}) => {
  const plain = { ...detalle };
  delete plain.valor_numerico;
  return plain;
};

const CONTROLLER_TAG = 'SeguimientoDeportivo';

class RequestError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.name = 'RequestError';
    this.status = status;
  }
}

const throwBadRequest = (message) => {
  throw new RequestError(message, 400);
};

const rollbackIfPending = async (transaction) => {
  if (transaction && !transaction.finished) {
    await transaction.rollback();
  }
};

const handleSeguimientoError = (res, method, error, fallbackMessage) => {
  console.error(`[${CONTROLLER_TAG}][${method}]`, error);
  if (error instanceof RequestError) {
    return res.status(error.status).json({ message: error.message });
  }
  return res.status(500).json({ message: fallbackMessage });
};

const findOrCreateMaestro = async (parametro, transaction) => {
  let maestro = await models.maestro_parametros.findOne({
    where: { parametro },
    transaction
  });
  if (!maestro) {
    maestro = await models.maestro_parametros.create({ parametro }, { transaction });
  }
  return maestro;
};

const findOrCreateCaracteristica = async (propiedad, transaction) => {
  let caracteristica = await models.caracteristicas.findOne({
    where: { propiedad },
    transaction
  });
  if (!caracteristica) {
    caracteristica = await models.caracteristicas.create({ propiedad }, { transaction });
  }
  return caracteristica;
};

const listSeguimientos = async (_req, res) => {
  try {
    const seguimientos = await models.seguimiento_deportivo.findAll({
      include: [
        {
          model: models.usuarios,
          as: 'id_usuario_usuario',
          attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email']
        },
        detalleInclude
      ]
    });
    const payload = seguimientos.map((s) => {
      const plain = s.get({ plain: true });
      // Alinear nombre esperado por el frontend
      plain.detalles = (plain.detalle_seguimientos || []).map(sanitizeDetalle);
      return plain;
    });
    return res.status(200).json(payload);
  } catch (error) {
    return handleSeguimientoError(
      res,
      'listSeguimientos',
      error,
      'Error al obtener seguimientos.'
    );
  }
};

const getSeguimientoById = async (req, res) => {
  try {
    const seguimiento = await models.seguimiento_deportivo.findByPk(req.seguimientoId, {
      include: [
        {
          model: models.usuarios,
          as: 'id_usuario_usuario',
          attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email']
        },
        detalleInclude
      ]
    });
    const plain = seguimiento.get({ plain: true });
    plain.detalles = (plain.detalle_seguimientos || []).map(sanitizeDetalle);
    return res.status(200).json(plain);
  } catch (error) {
    return handleSeguimientoError(
      res,
      'getSeguimientoById',
      error,
      'Error al obtener seguimiento.'
    );
  }
};

const createSeguimiento = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const payload = req.createSeguimientoPayload || {
      id_usuario: req.body?.id_usuario,
      deporte: req.body?.deporte,
      actividad: req.body?.actividad,
      fecha_registro: req.body?.fecha_registro
    };

    const detallesInput = normalizeDetallesInput(req.body);

    const nuevoSeguimiento = await models.seguimiento_deportivo.create(payload, { transaction });

    if (detallesInput.length > 0) {
      for (let i = 0; i < detallesInput.length; i += 1) {
        const detalle = detallesInput[i] || {};
        let idRelacion = parsePositiveInt(
          readDetalleField(detalle, [
            'id_relacion_seguimiento',
            'id_relacion',
            'relacion_seguimiento_id',
            'id_relacion_seguimiento_caracteristica',
            'id_relacion_caracteristica'
          ])
        );
        const hasValorRelacionInput = hasDetalleField(detalle, [
          'valor',
          'value',
          'valor_numerico',
          'valor_relacion',
          'valorRelacion'
        ]);
        const valorRelacion = hasValorRelacionInput
          ? parseOptionalFloat(
            readDetalleField(detalle, ['valor', 'value', 'valor_numerico', 'valor_relacion', 'valorRelacion'])
          )
          : null;
        const observacionesAliases = ['observaciones', 'observacion', 'nota', 'notas'];
        const hasObservacionesInput = hasDetalleField(detalle, observacionesAliases);
        const observacionesInput = parseOptionalObservation(
          hasObservacionesInput ? readDetalleFieldRaw(detalle, observacionesAliases) : undefined
        );
        const observacionesRelacion = observacionesInput.value;

        let idMaestro = parsePositiveInt(
          readDetalleField(detalle, [
            'id_maestro_p',
            'id_maestro',
            'id_parametros_s',
            'id_parametro',
            'maestro_parametro_id',
            'id_maestro_parametro'
          ])
        );
        let idCaracteristica = parsePositiveInt(
          readDetalleField(detalle, [
            'id_caracteristica',
            'id_caracteristicas',
            'caracteristica_id',
            'id_caracteristica_s'
          ])
        );

        const maestroNombre = normalizeText(
          readDetalleField(detalle, [
            'maestro_parametro',
            'parametro',
            'maestro',
            'nombre_parametro',
            'nombre_maestro'
          ])
        );
        const caracteristicaNombre = normalizeText(
          readDetalleField(detalle, [
            'caracteristica',
            'propiedad',
            'nombre_caracteristica',
            'nombre_propiedad'
          ])
        );
        if (maestroNombre && maestroNombre.length > 200) {
          throwBadRequest(`parametro no debe superar 200 caracteres (detalle #${i + 1}).`);
        }
        if (caracteristicaNombre && caracteristicaNombre.length > 200) {
          throwBadRequest(`propiedad no debe superar 200 caracteres (detalle #${i + 1}).`);
        }
        if (hasObservacionesInput && !observacionesInput.valid) {
          throwBadRequest(`Detalle #${i + 1} tiene observaciones invalidas.`);
        }
        if (observacionesRelacion && observacionesRelacion.length > 200) {
          throwBadRequest(`observaciones no debe superar 200 caracteres (detalle #${i + 1}).`);
        }

        if (!idRelacion) {
          if (!idMaestro && maestroNombre) {
            const maestro = await findOrCreateMaestro(maestroNombre, transaction);
            idMaestro = maestro.id_parametros_s;
          }

          if (!idCaracteristica && caracteristicaNombre) {
            const caracteristica = await findOrCreateCaracteristica(caracteristicaNombre, transaction);
            idCaracteristica = caracteristica.id_caracteristicas;
          }

          if (!idMaestro || !idCaracteristica) {
            throwBadRequest(
              `Detalle #${i + 1} debe incluir id_relacion_seguimiento o (id_maestro_p e id_caracteristica) o (parametro y propiedad).`
            );
          }
          if (hasValorRelacionInput && valorRelacion === null) {
            throwBadRequest(`Detalle #${i + 1} tiene valor invalido.`);
          }

          const [maestro, caracteristica] = await Promise.all([
            models.maestro_parametros.findByPk(idMaestro, { transaction }),
            models.caracteristicas.findByPk(idCaracteristica, { transaction })
          ]);

          if (!maestro) {
            if (maestroNombre) {
              const existing = await findOrCreateMaestro(maestroNombre, transaction);
              idMaestro = existing.id_parametros_s;
            } else {
              throwBadRequest(`El maestro_parametro con id '${idMaestro}' no existe.`);
            }
          }
          if (!caracteristica) {
            if (caracteristicaNombre) {
              const existing = await findOrCreateCaracteristica(caracteristicaNombre, transaction);
              idCaracteristica = existing.id_caracteristicas;
            } else {
              throwBadRequest(`La caracteristica con id '${idCaracteristica}' no existe.`);
            }
          }

          const relacionWhere = {
            id_maestro_p: idMaestro,
            id_caracteristica: idCaracteristica,
            valor: valorRelacion
          };
          if (hasObservacionesInput) {
            relacionWhere.observaciones = observacionesRelacion;
          }

          const [relacion] = await models.relacion_seguimiento_caracteristica.findOrCreate({
            where: relacionWhere,
            defaults: {
              id_maestro_p: idMaestro,
              id_caracteristica: idCaracteristica,
              valor: valorRelacion,
              observaciones: hasObservacionesInput ? observacionesRelacion : null
            },
            transaction
          });
          idRelacion = relacion.id_relacion_seguimiento;
        } else {
          const relacion = await models.relacion_seguimiento_caracteristica.findByPk(idRelacion, { transaction });
          if (!relacion) {
            throwBadRequest(
              `La relacion_seguimiento_caracteristica con id '${idRelacion}' no existe.`
            );
          }
          if (hasValorRelacionInput || hasObservacionesInput) {
            const dataToUpdate = {};
            if (hasValorRelacionInput) {
              if (valorRelacion === null) {
                throwBadRequest(`Detalle #${i + 1} tiene valor invalido.`);
              }
              dataToUpdate.valor = valorRelacion;
            }
            if (hasObservacionesInput) {
              dataToUpdate.observaciones = observacionesRelacion;
            }
            await relacion.update(dataToUpdate, { transaction });
          }
        }

        await models.detalle_seguimiento.create(
          {
            id_seguimiento: nuevoSeguimiento.id_seguimiento,
            id_relacion_seguimiento: idRelacion
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    const seguimientoCompleto = await models.seguimiento_deportivo.findByPk(
      nuevoSeguimiento.id_seguimiento,
      {
        include: [
          {
            model: models.usuarios,
            as: 'id_usuario_usuario',
            attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email']
          },
          detalleInclude
        ]
      }
    );

    if (!seguimientoCompleto) {
      return res.status(201).json(nuevoSeguimiento);
    }

    const plain = seguimientoCompleto.get({ plain: true });
    plain.detalles = (plain.detalle_seguimientos || []).map(sanitizeDetalle);
    return res.status(201).json(plain);
  } catch (error) {
    await rollbackIfPending(transaction);
    return handleSeguimientoError(
      res,
      'createSeguimiento',
      error,
      'Error al crear seguimiento.'
    );
  }
};

const updateSeguimiento = async (req, res) => {
  try {
    const payload = req.updateSeguimientoPayload || req.body;
    await req.seguimiento.update(payload);
    return res.status(200).json(req.seguimiento);
  } catch (error) {
    return handleSeguimientoError(
      res,
      'updateSeguimiento',
      error,
      'Error al actualizar seguimiento.'
    );
  }
};

const deleteSeguimiento = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    await models.detalle_seguimiento.destroy({
      where: { id_seguimiento: req.seguimiento.id_seguimiento },
      transaction
    });
    await req.seguimiento.destroy({ transaction });
    await transaction.commit();
    return res.status(200).json({ message: 'Seguimiento eliminado.' });
  } catch (error) {
    await rollbackIfPending(transaction);
    return handleSeguimientoError(
      res,
      'deleteSeguimiento',
      error,
      'Error al eliminar seguimiento.'
    );
  }
};

module.exports = {
  listSeguimientos,
  getSeguimientoById,
  createSeguimiento,
  updateSeguimiento,
  deleteSeguimiento
};
