const sequelize = require('../database');

const TAG = 'Membresias][expiracion';
const DEFAULT_INTERVAL_MINUTES = 60;
const CLEANUP_INTERVAL_MINUTES = Number(process.env.MEMBERSHIP_CLEANUP_INTERVAL_MINUTES);

let cleanupTimer = null;
let warnedMissingColumn = false;
let cleanupInProgress = false;

const getCleanupIntervalMinutes = () =>
  Number.isFinite(CLEANUP_INTERVAL_MINUTES) && CLEANUP_INTERVAL_MINUTES > 0
    ? CLEANUP_INTERVAL_MINUTES
    : DEFAULT_INTERVAL_MINUTES;

const isMissingExpirationColumnError = (error) => {
  const code = error?.original?.code || error?.parent?.code;
  if (code === '42703') return true;
  return String(error?.message || '').toLowerCase().includes('fecha_vencimiento');
};

const cleanupExpiredMemberships = async () => {
  try {
    const [, metadata] = await sequelize.query(`
      DELETE FROM public.detalles_cliente_beneficiarios
      WHERE fecha_vencimiento < CURRENT_DATE;
    `);

    const deletedRows = Number(metadata?.rowCount || 0);
    if (deletedRows > 0) {
      console.log(`[${TAG}] Registros eliminados por vencimiento: ${deletedRows}`);
    }

    warnedMissingColumn = false;
    return deletedRows;
  } catch (error) {
    if (isMissingExpirationColumnError(error)) {
      if (!warnedMissingColumn) {
        warnedMissingColumn = true;
        console.warn(
          `[${TAG}] Columna fecha_vencimiento no encontrada. Ejecuta la migracion db:migrate:membresias-vencimiento.`
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
    await cleanupExpiredMemberships();
  } catch (error) {
    console.error(`[${TAG}] Error en limpieza programada:`, error);
  } finally {
    cleanupInProgress = false;
  }
};

const scheduleExpiredMembershipCleanup = () => {
  if (cleanupTimer) return cleanupTimer;

  const intervalMs = getCleanupIntervalMinutes() * 60 * 1000;
  cleanupTimer = setInterval(runScheduledCleanup, intervalMs);

  if (typeof cleanupTimer.unref === 'function') {
    cleanupTimer.unref();
  }

  return cleanupTimer;
};

const stopExpiredMembershipCleanup = () => {
  if (!cleanupTimer) return;
  clearInterval(cleanupTimer);
  cleanupTimer = null;
};

module.exports = {
  cleanupExpiredMemberships,
  scheduleExpiredMembershipCleanup,
  stopExpiredMembershipCleanup
};
