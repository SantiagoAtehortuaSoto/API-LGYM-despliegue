require('dotenv').config();
const { Sequelize } = require('sequelize');

const parseBoolean = (value, defaultValue = false) => {
  if (value === undefined || value === null || value === '') return defaultValue;
  const normalized = String(value).trim().toLowerCase();
  if (['true', '1', 'yes', 'y', 'on'].includes(normalized)) return true;
  if (['false', '0', 'no', 'n', 'off'].includes(normalized)) return false;
  return defaultValue;
};

const parsePort = (value) => {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`[DB] DB_PORT invalido: "${value}"`);
  }
  return parsed;
};

const {
  DATABASE_URL,
  DB_HOST = '127.0.0.1',
  DB_PORT,
  DB_USER = 'postgres',
  DB_PASS = '',
  DB_NAME = 'LGYM',
  DB_SSL = 'true',
  DB_SSL_REJECT_UNAUTHORIZED = 'true'
} = process.env;

const useSsl = parseBoolean(DB_SSL, true);
const rejectUnauthorized = parseBoolean(DB_SSL_REJECT_UNAUTHORIZED, true);
const dbPort = parsePort(DB_PORT);

const baseConfig = {
  dialect: 'postgres',
  logging: false
};

if (useSsl) {
  baseConfig.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized
    }
  };
}

const sequelize = DATABASE_URL
  ? new Sequelize(DATABASE_URL, baseConfig)
  : new Sequelize(DB_NAME, DB_USER, DB_PASS, {
      ...baseConfig,
      host: DB_HOST,
      port: dbPort
    });

module.exports = sequelize;
