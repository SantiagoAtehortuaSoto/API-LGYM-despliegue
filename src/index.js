require('dotenv').config();
const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

const sequelize = require('./database');
const { syncAll } = require('./sync-db');
const {
  cleanupExpiredMemberships,
  scheduleExpiredMembershipCleanup,
  stopExpiredMembershipCleanup
} = require('./services/membresias-expiracion.service');
const {
  cleanupExpiredPendingSales,
  scheduleExpiredPendingSalesCleanup,
  stopExpiredPendingSalesCleanup
} = require('./services/ventas-expiracion.service');

// CORS middleware (custom)
app.use(require('./middleware/cors'));

app.use(express.json({ limit: '50mb' }));
const routes = require('./routes');
app.use('/', routes);

let server;
let isShuttingDown = false;

async function shutdown(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`[Server] ${signal} recibido. Cerrando servicios...`);

  try {
    stopExpiredMembershipCleanup();
    stopExpiredPendingSalesCleanup();

    if (server) {
      await new Promise((resolve, reject) => {
        server.close((error) => {
          if (error) return reject(error);
          resolve();
        });
      });
    }

    await sequelize.close();
    console.log('[Server] Conexion de base de datos cerrada.');
    process.exit(0);
  } catch (error) {
    console.error('[Server] Error durante el cierre graceful:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

// Start the server
async function startServer() {
  try {
    await sequelize.authenticate();
    const shouldAlter = process.env.DB_SYNC_ALTER === 'true';
    await syncAll({ alter: shouldAlter });
    console.log('Conexion a la base de datos establecida correctamente.');

    try {
      await cleanupExpiredMemberships();
      scheduleExpiredMembershipCleanup();
    } catch (cleanupError) {
      console.error('[Membresias][expiracion] No se pudo iniciar la limpieza automatica:', cleanupError);
    }

    try {
      await cleanupExpiredPendingSales();
      scheduleExpiredPendingSalesCleanup();
    } catch (cleanupError) {
      console.error('[Ventas][expiracion] No se pudo iniciar la limpieza automatica:', cleanupError);
    }

    server = app.listen(port, '0.0.0.0', () => {
      console.log(`API LGYM iniciada en puerto ${port}`);
    });
  } catch (error) {
    console.error('Error al iniciar la API o conectar a la base de datos:', error);
    process.exit(1); // Terminar el proceso con un codigo de error
  }
}

startServer();
