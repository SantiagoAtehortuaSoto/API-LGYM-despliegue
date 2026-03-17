const sequelize = require('../database');
const { QueryTypes } = require('sequelize');

const TAG = 'Ventas][expiracion';
const DEFAULT_INTERVAL_MINUTES = 60;
const CLEANUP_INTERVAL_MINUTES = Number(process.env.PENDING_SALES_CLEANUP_INTERVAL_MINUTES);
const DEFAULT_PENDING_STATE_IDS = [3];
const DEFAULT_CANCEL_STATE_IDS = [5, 6];
const ESTADO_LOOKUP_NAMES = ['PENDIENTE', 'CANCELADO'];

let cleanupTimer = null;
let warnedMissingDeadlineColumn = false;
let cleanupInProgress = false;

const getCleanupIntervalMinutes = () =>
  Number.isFinite(CLEANUP_INTERVAL_MINUTES) && CLEANUP_INTERVAL_MINUTES > 0
    ? CLEANUP_INTERVAL_MINUTES
    : DEFAULT_INTERVAL_MINUTES;

const getLocalToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const sanitizeIntegerList = (values = []) => [
  ...new Set(
    values
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value))
  )
];

const isMissingDeadlineColumnError = (error) => {
  const code = error?.original?.code || error?.parent?.code;
  if (code === '42703') return true;
  return String(error?.message || '').toLowerCase().includes('plazo_maximo');
};

const resolveVentaEstadoIds = async (transaction) => {
  const lookupIds = sanitizeIntegerList([...DEFAULT_PENDING_STATE_IDS, ...DEFAULT_CANCEL_STATE_IDS]);
  const lookupIdsSql = lookupIds.join(', ');
  const lookupNamesSql = ESTADO_LOOKUP_NAMES.map((name) => `'${name}'`).join(', ');

  const rows = await sequelize.query(
    `
      SELECT id_estado, UPPER(estado) AS estado
      FROM public.estados
      WHERE UPPER(estado) IN (${lookupNamesSql})
         OR id_estado IN (${lookupIdsSql});
    `,
    {
      type: QueryTypes.SELECT,
      transaction
    }
  );

  const pendingIds = new Set(DEFAULT_PENDING_STATE_IDS);
  let cancelId = null;
  const availableIds = new Set();

  rows.forEach((row) => {
    const estadoId = Number(row.id_estado);
    if (!Number.isInteger(estadoId)) {
      return;
    }

    availableIds.add(estadoId);

    if (row.estado === 'PENDIENTE') {
      pendingIds.add(estadoId);
    }
    if (row.estado === 'CANCELADO') {
      cancelId = estadoId;
    }
  });

  if (!Number.isInteger(cancelId)) {
    cancelId = DEFAULT_CANCEL_STATE_IDS.find((estadoId) => availableIds.has(estadoId)) ?? null;
  }

  return {
    pendingIds: sanitizeIntegerList([...pendingIds]),
    cancelId: Number.isInteger(cancelId) ? cancelId : null
  };
};

const cleanupExpiredPendingSales = async () => {
  const transaction = await sequelize.transaction();

  try {
    const { pendingIds, cancelId } = await resolveVentaEstadoIds(transaction);

    if (!pendingIds.length || !Number.isInteger(cancelId)) {
      await transaction.rollback();
      console.warn(`[${TAG}] No se encontraron estados validos para cancelar ventas pendientes vencidas.`);
      return 0;
    }

    const pendingIdsSql = pendingIds.join(', ');
    const today = getLocalToday();
    const [result] = await sequelize.query(
      `
        WITH expired_sales AS (
          SELECT pc.id_pedido_cliente
          FROM public.pedidos_clientes pc
          WHERE pc.id_estado IN (${pendingIdsSql})
            AND pc.plazo_maximo IS NOT NULL
            AND pc.plazo_maximo <= :today
          FOR UPDATE SKIP LOCKED
        ),
        restocked AS (
          UPDATE public.productos p
          SET stock = COALESCE(p.stock, 0) + source.total_cantidad
          FROM (
            SELECT dv.id_producto, SUM(COALESCE(dv.cantidad, 0))::integer AS total_cantidad
            FROM public.detalles_venta dv
            INNER JOIN expired_sales es ON es.id_pedido_cliente = dv.id_pedido_cliente
            WHERE dv.id_producto IS NOT NULL
            GROUP BY dv.id_producto
          ) source
          WHERE p.id_productos = source.id_producto
        ),
        canceled AS (
          UPDATE public.pedidos_clientes pc
          SET id_estado = ${cancelId}
          WHERE pc.id_pedido_cliente IN (SELECT id_pedido_cliente FROM expired_sales)
            AND pc.id_estado IN (${pendingIdsSql})
          RETURNING pc.id_pedido_cliente
        )
        SELECT COUNT(*)::integer AS canceled_rows
        FROM canceled;
      `,
      {
        replacements: { today },
        type: QueryTypes.SELECT,
        transaction
      }
    );

    const canceledRows = Number(result?.canceled_rows || 0);
    await transaction.commit();

    warnedMissingDeadlineColumn = false;

    if (canceledRows > 0) {
      console.log(`[${TAG}] Ventas canceladas automaticamente por vencimiento: ${canceledRows}`);
    }

    return canceledRows;
  } catch (error) {
    await transaction.rollback();

    if (isMissingDeadlineColumnError(error)) {
      if (!warnedMissingDeadlineColumn) {
        warnedMissingDeadlineColumn = true;
        console.warn(
          `[${TAG}] Columna plazo_maximo no encontrada. Ejecuta la migracion db:migrate:plazo-maximo-pedidos.`
        );
      }
      return 0;
    }

    throw error;
  }
};

const runScheduledCleanup = async () => {
  if (cleanupInProgress) {
    return;
  }

  cleanupInProgress = true;
  try {
    await cleanupExpiredPendingSales();
  } catch (error) {
    console.error(`[${TAG}] Error en limpieza programada:`, error);
  } finally {
    cleanupInProgress = false;
  }
};

const scheduleExpiredPendingSalesCleanup = () => {
  if (cleanupTimer) return cleanupTimer;

  const intervalMs = getCleanupIntervalMinutes() * 60 * 1000;
  cleanupTimer = setInterval(runScheduledCleanup, intervalMs);

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return cleanupTimer;
};

const stopExpiredPendingSalesCleanup = () => {
  if (!cleanupTimer) return;
  clearInterval(cleanupTimer);
  cleanupTimer = null;
};

module.exports = {
  cleanupExpiredPendingSales,
  scheduleExpiredPendingSalesCleanup,
  stopExpiredPendingSalesCleanup
};
