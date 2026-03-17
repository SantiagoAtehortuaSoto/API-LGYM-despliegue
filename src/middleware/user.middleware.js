const initModels = require('../models/init-models');
const sequelize = require('../database');
const normalizeEmail = require('../utils/normalizeEmail');

const models = initModels(sequelize);
const TAG = 'UserMiddleware';

const buildEmailWhereClause = (normalizedEmail) =>
  sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), normalizedEmail);

const getRequestValue = (req, key) => {
  if (req.body && req.body[key] !== undefined) return req.body[key];
  if (req.query && req.query[key] !== undefined) return req.query[key];
  return undefined;
};

const checkEmailExistsMiddleware = async (req, res) => {
  const normalizedEmail = normalizeEmail(getRequestValue(req, 'email'));
  if (!normalizedEmail) {
    return res.status(400).json({ message: 'El campo email es requerido.' });
  }

  try {
    const user = await models.usuarios.findOne({
      where: buildEmailWhereClause(normalizedEmail),
      attributes: ['id_usuario']
    });
    const exists = Boolean(user);
    return res.status(200).json({
      exists,
      message: exists ? 'El correo ya esta registrado.' : 'El correo no se encuentra registrado.'
    });
  } catch (error) {
    console.error(`[${TAG}][checkEmailExistsMiddleware]`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

const checkDocumentoExistsMiddleware = async (req, res) => {
  const rawDocumento = getRequestValue(req, 'documento');
  const documento = rawDocumento === undefined || rawDocumento === null ? '' : String(rawDocumento).trim();

  if (!documento) {
    return res.status(400).json({ message: 'El campo documento es requerido.' });
  }

  try {
    const user = await models.usuarios.findOne({
      where: { documento },
      attributes: ['id_usuario']
    });
    const exists = Boolean(user);
    return res.status(200).json({
      exists,
      message: exists ? 'El documento ya esta registrado.' : 'El documento no se encuentra registrado.'
    });
  } catch (error) {
    console.error(`[${TAG}][checkDocumentoExistsMiddleware]`, error);
    return res.status(500).json({ message: 'Error interno del servidor.' });
  }
};

module.exports = {
  checkEmailExistsMiddleware,
  checkDocumentoExistsMiddleware
};
