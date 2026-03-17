const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Op } = require('sequelize');
const initModels = require('../models/init-models');
const sequelize = require('../database');
const emailService = require('../services/email.service');
const normalizeEmail = require('../utils/normalizeEmail');
const {
  isAtLeastMinimumUserAge,
  getMinimumAgeValidationMessage
} = require('../utils/userAge');
const {
  paginateModel,
  getPaginationParams,
  buildPaginatedResponse
} = require('../utils/pagination');
const { ensureAccessControl } = require('../middleware/authorization');

const models = initModels(sequelize);

const CONTROLLER_TAG = 'Usuarios';
const USER_SAFE_ATTRIBUTES = { exclude: ['password'] };
const ROLE_INCLUDE = [{ model: models.rol, as: 'id_rol_rol', attributes: ['id_rol', 'nombre'] }];
const ASSIGNMENTS_INCLUDE = [
  {
    model: models.rol,
    as: 'id_rol_rol',
    attributes: ['id_rol', 'nombre'],
    include: [
      {
        model: models.detallesrol,
        as: 'detallesrols',
        attributes: ['id_permiso', 'id_privilegio'],
        include: [
          {
            model: models.permisos,
            as: 'id_permiso_permiso',
            attributes: ['id_permiso', 'nombre']
          },
          {
            model: models.privilegios,
            as: 'id_privilegio_privilegio',
            attributes: ['id_privilegio', 'nombre']
          }
        ]
      }
    ]
  }
];

const SECRET_KEY = process.env.SECRET_KEY || 'your_secret_key';
const TOKEN_EXPIRES_IN = process.env.TOKEN_EXPIRES_IN || null;
const ADMIN_ROLE_NAME = (process.env.ADMIN_ROLE_NAME || 'Administrador').trim().toLowerCase();
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID || 1);
const ADMIN_USER_ID = Number(process.env.ADMIN_USER_ID || NaN);
const DEFAULT_ROLE_ID = Number(process.env.DEFAULT_ROLE_ID || 33);
const CLIENT_ROLE_ID = DEFAULT_ROLE_ID;
const PROTECTED_DELETE_ROLE_ID = Number(process.env.PROTECTED_DELETE_ROLE_ID || 32);
const PENDING_STATE_ID = Number(process.env.USER_PENDING_STATE_ID || 2);
const ACTIVE_STATE_ID = Number(process.env.USER_ACTIVE_STATE_ID || 1);

class HttpError extends Error {
  constructor(statusCode, message, details = null) {
    super(message);
    this.name = 'HttpError';
    this.statusCode = statusCode;
    this.details = details;
  }
}

const createHttpError = (statusCode, message, details = null) =>
  new HttpError(statusCode, message, details);

const rollbackIfPending = async (transaction) => {
  if (transaction && !transaction.finished) {
    await transaction.rollback();
  }
};

const handleControllerError = (res, method, error, fallbackMessage) => {
  console.error(`[${CONTROLLER_TAG}][${method}]`, error);

  if (error instanceof HttpError || Number.isInteger(error?.statusCode)) {
    const statusCode = Number(error.statusCode) || 400;
    if (error.details) {
      return res.status(statusCode).json({ message: error.message, errors: error.details });
    }
    return res.status(statusCode).json({ message: error.message });
  }

  if (error?.name === 'SequelizeValidationError') {
    return res.status(400).json({
      message: 'Error de validacion.',
      errors: (error.errors || []).map((item) => item.message)
    });
  }

  if (error?.name === 'SequelizeUniqueConstraintError') {
    return res.status(409).json({ message: 'Ya existe un registro con los datos enviados.' });
  }

  if (error?.name === 'SequelizeForeignKeyConstraintError') {
    return res.status(400).json({ message: 'Datos relacionados no validos.' });
  }

  return res.status(500).json({ message: fallbackMessage });
};

const parsePositiveInt = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const normalizeRoleName = (value) =>
  typeof value === 'string' ? value.trim().toLowerCase() : '';

const getLocalToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const hashPassword = (rawValue) => {
  const salt = bcrypt.genSaltSync(10);
  return bcrypt.hashSync(String(rawValue), salt);
};

const sanitizeUser = (user) => {
  if (!user) return null;
  const plain = typeof user.toJSON === 'function' ? user.toJSON() : { ...user };
  delete plain.password;
  return plain;
};

const buildEmailWhereClause = (normalizedEmail) =>
  sequelize.where(sequelize.fn('LOWER', sequelize.col('email')), normalizedEmail);

const getRequesterId = (req) => parsePositiveInt(req.user?.id);

const ensureAuthenticatedUserId = (req) => {
  const userId = getRequesterId(req);
  if (!userId) {
    throw createHttpError(401, 'Usuario no autenticado.');
  }
  return userId;
};

const ensureMinimumUserAge = (fechaNacimiento) => {
  if (!isAtLeastMinimumUserAge(fechaNacimiento)) {
    throw createHttpError(400, getMinimumAgeValidationMessage());
  }
};

const loadRoleAssignments = async (userId, transaction = null) =>
  models.roles_usuarios.findAll({
    where: { id_usuario: userId },
    attributes: ['id_rol', 'id_usuario', 'id_rol_usuario'],
    include: ROLE_INCLUDE,
    order: [['id_rol_usuario', 'ASC']],
    transaction
  });

const isAdminRoleMatch = (roleInfo) => {
  const roleId = parsePositiveInt(roleInfo?.id_rol);
  const roleName = normalizeRoleName(roleInfo?.nombre);
  return (
    (roleId && roleId === ADMIN_ROLE_ID) ||
    (roleName && roleName === normalizeRoleName(ADMIN_ROLE_NAME))
  );
};

const userHasAdminRole = async (userId) => {
  if (!parsePositiveInt(userId)) return false;
  const assignments = await loadRoleAssignments(userId);
  return assignments.some((assignment) => {
    const role = assignment.id_rol_rol;
    return isAdminRoleMatch({ id_rol: assignment.id_rol ?? role?.id_rol, nombre: role?.nombre });
  });
};

const isAdminContext = async (req) => {
  const requesterId = getRequesterId(req);
  if (!requesterId) return false;

  if (Number.isInteger(ADMIN_USER_ID) && requesterId === ADMIN_USER_ID) {
    return true;
  }
  if (req.accessControl?.isAdmin) {
    return true;
  }
  return userHasAdminRole(requesterId);
};

const loadUserRoleInfo = async (userId, transaction = null) => {
  const assignments = await loadRoleAssignments(userId, transaction);
  if (!assignments.length) return null;

  const mapped = assignments.map((assignment) => {
    const role = assignment.id_rol_rol;
    return role
      ? { id_rol: role.id_rol, nombre: role.nombre }
      : { id_rol: assignment.id_rol, nombre: null };
  });

  const adminRole = mapped.find((roleInfo) => isAdminRoleMatch(roleInfo));
  return adminRole || mapped[0];
};

const signUserToken = (user, roleInfo) => {
  const payload = { id: user.id_usuario, email: user.email, role: roleInfo };
  return TOKEN_EXPIRES_IN
    ? jwt.sign(payload, SECRET_KEY, { expiresIn: TOKEN_EXPIRES_IN })
    : jwt.sign(payload, SECRET_KEY);
};

const validateRoleExists = async (rolId, transaction = null) => {
  const parsedRoleId = parsePositiveInt(rolId);
  if (!parsedRoleId) {
    throw createHttpError(400, 'El rol proporcionado no es valido.');
  }

  const role = await models.rol.findByPk(parsedRoleId, { transaction });
  if (!role) {
    throw createHttpError(404, 'Rol no encontrado.');
  }

  return parsedRoleId;
};

const assignRoleToUser = async (userId, rolId, transaction = null) => {
  const parsedRoleId = await validateRoleExists(rolId, transaction);
  const [record, created] = await models.roles_usuarios.findOrCreate({
    where: { id_usuario: userId },
    defaults: { id_usuario: userId, id_rol: parsedRoleId },
    transaction
  });

  if (!created && Number(record.id_rol) !== parsedRoleId) {
    await record.update({ id_rol: parsedRoleId }, { transaction });
  }
};

const removeRoleFromUser = async (userId, transaction = null) => {
  await models.roles_usuarios.destroy({ where: { id_usuario: userId }, transaction });
};

const getDistinctUserIdsByRoleIds = async (roleIds = []) => {
  const normalizedRoleIds = [...new Set(
    roleIds
      .map((roleId) => parsePositiveInt(roleId))
      .filter(Boolean)
  )];

  if (!normalizedRoleIds.length) {
    return [];
  }

  const assignments = await models.roles_usuarios.findAll({
    where: {
      id_rol: { [Op.in]: normalizedRoleIds }
    },
    attributes: ['id_usuario'],
    raw: true
  });

  return [...new Set(
    assignments
      .map((assignment) => Number(assignment.id_usuario))
      .filter((userId) => Number.isInteger(userId) && userId > 0)
  )];
};

const buildEmptyUsersPage = (req) => {
  const { page, limit } = getPaginationParams(req?.query);
  return buildPaginatedResponse({
    rows: [],
    count: 0,
    page,
    limit
  });
};

const listUsersByRoleFilter = async ({
  req,
  res,
  roleIds,
  exclude = false,
  method,
  fallbackMessage
}) => {
  try {
    const userIds = await getDistinctUserIdsByRoleIds(roleIds);

    if (!exclude && !userIds.length) {
      return res.status(200).json(buildEmptyUsersPage(req));
    }

    const where = exclude
      ? (userIds.length ? { id_usuario: { [Op.notIn]: userIds } } : undefined)
      : { id_usuario: { [Op.in]: userIds } };

    const users = await paginateModel(models.usuarios, req, {
      attributes: USER_SAFE_ATTRIBUTES,
      excludedSearchFields: ['password'],
      order: [['id_usuario', 'ASC']],
      ...(where ? { where } : {})
    });

    return res.status(200).json(users);
  } catch (error) {
    return handleControllerError(res, method, error, fallbackMessage);
  }
};

const getUsers = async (req, res) => {
  try {
    const users = await paginateModel(models.usuarios, req, {
      attributes: USER_SAFE_ATTRIBUTES,
      excludedSearchFields: ['password'],
      order: [['id_usuario', 'ASC']]
    });
    return res.status(200).json(users);
  } catch (error) {
    return handleControllerError(res, 'getUsers', error, 'Error al obtener usuarios.');
  }
};

const getClientUsers = async (req, res) =>
  listUsersByRoleFilter({
    req,
    res,
    roleIds: [CLIENT_ROLE_ID],
    method: 'getClientUsers',
    fallbackMessage: 'Error al obtener usuarios cliente.'
  });

const getNonClientNonAdminUsers = async (req, res) =>
  listUsersByRoleFilter({
    req,
    res,
    roleIds: [CLIENT_ROLE_ID, ADMIN_ROLE_ID],
    exclude: true,
    method: 'getNonClientNonAdminUsers',
    fallbackMessage: 'Error al obtener usuarios sin rol cliente ni administrador.'
  });

const getUserSelf = async (req, res) => {
  try {
    const requesterId = ensureAuthenticatedUserId(req);
    const user = await models.usuarios.findByPk(requesterId, { attributes: USER_SAFE_ATTRIBUTES });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    return res.status(200).json(user);
  } catch (error) {
    return handleControllerError(res, 'getUserSelf', error, 'Error al obtener usuario autenticado.');
  }
};

const getUserById = async (req, res) => {
  try {
    const user = await models.usuarios.findByPk(req.params.id, { attributes: USER_SAFE_ATTRIBUTES });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }
    return res.status(200).json(user);
  } catch (error) {
    return handleControllerError(res, 'getUserById', error, 'Error al obtener usuario.');
  }
};

const createUser = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const {
      nombre_usuario,
      apellido_usuario,
      tipo_documento,
      documento,
      email,
      telefono,
      c_emergencia,
      n_emergencia,
      fecha_nacimiento,
      genero,
      password,
      enfermedades,
      id_estado = null,
      rol_id
    } = req.body || {};

    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail || !password) {
      throw createHttpError(400, 'Email y password son requeridos.');
    }
    ensureMinimumUserAge(fecha_nacimiento);

    let roleToAssign = DEFAULT_ROLE_ID;
    if (rol_id !== undefined && rol_id !== null) {
      const requesterIsAdmin = await isAdminContext(req);
      if (!requesterIsAdmin) {
        throw createHttpError(403, 'Solo un administrador puede asignar roles al crear usuarios.');
      }
      roleToAssign = rol_id;
    }

    const effectiveStateId = id_estado !== null && id_estado !== undefined ? id_estado : PENDING_STATE_ID;
    const newUser = await models.usuarios.create(
      {
        nombre_usuario,
        apellido_usuario,
        tipo_documento,
        documento,
        email: normalizedEmail,
        telefono,
        c_emergencia,
        n_emergencia,
        fecha_nacimiento,
        genero,
        password: hashPassword(password),
        enfermedades,
        id_estado: effectiveStateId,
        fecha_registro: getLocalToday()
      },
      { transaction, logging: false }
    );

    await assignRoleToUser(newUser.id_usuario, roleToAssign, transaction);
    await transaction.commit();

    const userResponse = sanitizeUser(newUser);
    const verificationCode = emailService.createAccountVerificationCode(normalizedEmail);
    const emailSent = await emailService.sendVerificationEmail(
      newUser.email,
      verificationCode,
      'Verifica tu cuenta - LGYM'
    );

    if (!emailSent) {
      return res.status(201).json({
        message:
          'Usuario creado, pero no se pudo enviar el correo de verificacion. Puedes solicitar un reenvio del codigo.',
        usuario: userResponse
      });
    }

    return res.status(201).json({
      message: 'Usuario creado exitosamente. Revisa tu correo para verificar la cuenta.',
      usuario: userResponse
    });
  } catch (error) {
    await rollbackIfPending(transaction);
    return handleControllerError(res, 'createUser', error, 'Error al crear usuario.');
  }
};

const updateUser = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const beneficiarioFields = ['id_relacion', 'id_membresia', 'id_estado_membresia', 'id_beneficiario'];
    const hasBeneficiarioPayload = beneficiarioFields.some((field) => req.body?.[field] !== undefined);
    if (hasBeneficiarioPayload) {
      throw createHttpError(
        400,
        'Para asociar un beneficiario a un cliente use el endpoint POST /beneficiarios con id_usuario e id_relacion.'
      );
    }

    const user = await models.usuarios.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!user) {
      throw createHttpError(404, 'Usuario no encontrado.');
    }

    const { rol_id, ...userData } = req.body || {};
    delete userData.fecha_registro;

    if (userData.email !== undefined) {
      const normalized = normalizeEmail(userData.email);
      if (!normalized) {
        throw createHttpError(400, 'Email invalido.');
      }
      userData.email = normalized;
    }

    if (userData.password !== undefined) {
      const rawPass = userData.password;
      if (rawPass === null || rawPass === '' || rawPass === false) {
        delete userData.password;
      } else {
        userData.password = hashPassword(rawPass);
      }
    }

    if (userData.fecha_nacimiento !== undefined) {
      ensureMinimumUserAge(userData.fecha_nacimiento);
    }

    await user.update(userData, { transaction });

    let roleInfoUpdated = null;
    let roleChanged = false;
    if (rol_id !== undefined) {
      const requesterIsAdmin = await isAdminContext(req);
      if (!requesterIsAdmin) {
        throw createHttpError(403, 'Solo un administrador puede modificar roles.');
      }

      roleChanged = true;
      if (rol_id === null) {
        await removeRoleFromUser(user.id_usuario, transaction);
      } else {
        await assignRoleToUser(user.id_usuario, rol_id, transaction);
      }

      roleInfoUpdated = await loadUserRoleInfo(user.id_usuario, transaction);
    }

    await transaction.commit();

    if (
      roleChanged &&
      parsePositiveInt(req.user?.id) === parsePositiveInt(user.id_usuario) &&
      roleInfoUpdated
    ) {
      res.set('x-refreshed-token', signUserToken(user, roleInfoUpdated));
    }

    return res.status(200).json({ message: 'Usuario actualizado', role: roleInfoUpdated });
  } catch (error) {
    await rollbackIfPending(transaction);
    return handleControllerError(res, 'updateUser', error, 'Error al actualizar usuario.');
  }
};

const updateUserSelf = async (req, res) => {
  try {
    const requesterId = ensureAuthenticatedUserId(req);
    const user = await models.usuarios.findByPk(requesterId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const allowedFields = [
      'nombre_usuario',
      'apellido_usuario',
      'telefono',
      'c_emergencia',
      'n_emergencia',
      'fecha_nacimiento',
      'genero',
      'tipo_documento',
      'documento',
      'email',
      'enfermedades'
    ];

    const updates = {};
    allowedFields.forEach((field) => {
      if (req.body?.[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (updates.email !== undefined) {
      const normalized = normalizeEmail(updates.email);
      if (!normalized) {
        throw createHttpError(400, 'Email invalido.');
      }
      updates.email = normalized;
    }

    if (updates.fecha_nacimiento !== undefined) {
      ensureMinimumUserAge(updates.fecha_nacimiento);
    }

    if (!Object.keys(updates).length) {
      throw createHttpError(400, 'No hay cambios para aplicar.');
    }

    await user.update(updates);
    return res.status(200).json({ message: 'Perfil actualizado', usuario: sanitizeUser(user) });
  } catch (error) {
    return handleControllerError(res, 'updateUserSelf', error, 'Error al actualizar perfil.');
  }
};

const deleteUser = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const user = await models.usuarios.findByPk(req.params.id, {
      transaction,
      lock: transaction.LOCK.UPDATE
    });
    if (!user) {
      throw createHttpError(404, 'Usuario no encontrado.');
    }

    const hasProtectedRole = await models.roles_usuarios.findOne({
      where: { id_usuario: user.id_usuario, id_rol: PROTECTED_DELETE_ROLE_ID },
      attributes: ['id_rol_usuario'],
      transaction
    });

    if (hasProtectedRole) {
      throw createHttpError(
        403,
        `No se puede eliminar un usuario con rol administrador (id_rol=${PROTECTED_DELETE_ROLE_ID}).`
      );
    }

    await models.roles_usuarios.destroy({ where: { id_usuario: user.id_usuario }, transaction });
    await user.destroy({ transaction });

    await transaction.commit();
    return res.status(200).json({ message: 'Usuario eliminado.' });
  } catch (error) {
    await rollbackIfPending(transaction);

    if (error?.name === 'SequelizeForeignKeyConstraintError') {
      return res.status(400).json({
        message:
          'No se puede eliminar el usuario porque tiene registros asociados (ventas, beneficiarios u otros).'
      });
    }

    return handleControllerError(res, 'deleteUser', error, 'Error al eliminar usuario.');
  }
};

const login = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!normalizedEmail || !password) {
      throw createHttpError(400, 'Email y password son requeridos.');
    }

    const user = await models.usuarios.findOne({ where: buildEmailWhereClause(normalizedEmail) });
    if (!user || !user.password) {
      return res.status(401).json({ message: 'Email o contrasena incorrectos.' });
    }

    let isMatch = false;
    try {
      isMatch = bcrypt.compareSync(password, user.password);
    } catch (compareError) {
      console.error(`[${CONTROLLER_TAG}][login] Error comparando contrasena:`, compareError);
      return res.status(401).json({ message: 'Email o contrasena incorrectos.' });
    }

    if (!isMatch) {
      return res.status(401).json({ message: 'Email o contrasena incorrectos.' });
    }

    if (Number(user.id_estado) === PENDING_STATE_ID) {
      return res.status(403).json({ message: 'Tu cuenta esta pendiente de verificacion. Revisa tu correo.' });
    }

    const roleInfo = await loadUserRoleInfo(user.id_usuario);
    const token = signUserToken(user, roleInfo);
    return res.status(200).json({ message: 'Login exitoso', token, role: roleInfo });
  } catch (error) {
    return handleControllerError(res, 'login', error, 'Error al procesar la autenticacion.');
  }
};

const resetPassword = async (req, res) => {
  try {
    const requesterId = ensureAuthenticatedUserId(req);
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      throw createHttpError(400, 'Se requiere la contrasena anterior y la nueva contrasena.');
    }

    const user = await models.usuarios.findByPk(requesterId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const isMatch = bcrypt.compareSync(oldPassword, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Contrasena actual incorrecta.' });
    }

    await user.update({ password: hashPassword(newPassword) });
    return res.status(200).json({ message: 'Contrasena actualizada exitosamente.' });
  } catch (error) {
    return handleControllerError(res, 'resetPassword', error, 'Error al restablecer contrasena.');
  }
};

const forgotPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail) {
      throw createHttpError(400, 'Email es requerido.');
    }

    const user = await models.usuarios.findOne({ where: buildEmailWhereClause(normalizedEmail) });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const verificationCode = emailService.createResetPasswordCode(normalizedEmail);
    const emailSent = await emailService.sendVerificationEmail(
      user.email,
      verificationCode,
      'Codigo para restablecer contrasena - LGYM'
    );

    if (!emailSent) {
      return res.status(500).json({ message: 'Error al enviar el codigo de verificacion.' });
    }

    return res.status(200).json({ message: 'Se ha enviado un codigo de verificacion a tu email.' });
  } catch (error) {
    return handleControllerError(res, 'forgotPassword', error, 'Error al procesar la solicitud.');
  }
};

const confirmResetPassword = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const newPassword = req.body?.newPassword;

    if (!normalizedEmail || !newPassword) {
      throw createHttpError(400, 'Email y nueva contrasena son requeridos.');
    }

    const user = await models.usuarios.findOne({ where: buildEmailWhereClause(normalizedEmail) });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    await user.update({ password: hashPassword(newPassword) });
    return res.status(200).json({ message: 'Contrasena actualizada exitosamente.' });
  } catch (error) {
    return handleControllerError(
      res,
      'confirmResetPassword',
      error,
      'Error al procesar la solicitud.'
    );
  }
};

const verifyEmail = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    const verificationCode = req.body?.verificationcode;

    if (!normalizedEmail || !verificationCode) {
      throw createHttpError(400, 'Email y verificationcode son requeridos.');
    }

    const user = await models.usuarios.findOne({ where: buildEmailWhereClause(normalizedEmail) });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (Number(user.id_estado) === ACTIVE_STATE_ID) {
      return res.status(409).json({ message: 'La cuenta ya esta verificada.' });
    }

    const isValid = emailService.verifyAccountCode(normalizedEmail, verificationCode);
    if (!isValid) {
      throw createHttpError(400, 'Codigo invalido o expirado.');
    }

    await user.update({ id_estado: ACTIVE_STATE_ID });
    return res.status(200).json({ message: 'Cuenta verificada exitosamente.' });
  } catch (error) {
    return handleControllerError(res, 'verifyEmail', error, 'Error al verificar la cuenta.');
  }
};

const resendVerification = async (req, res) => {
  try {
    const normalizedEmail = normalizeEmail(req.body?.email);
    if (!normalizedEmail) {
      throw createHttpError(400, 'Email es requerido.');
    }

    const user = await models.usuarios.findOne({ where: buildEmailWhereClause(normalizedEmail) });
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    if (Number(user.id_estado) === ACTIVE_STATE_ID) {
      return res.status(409).json({ message: 'La cuenta ya esta verificada.' });
    }

    const verificationCode = emailService.createAccountVerificationCode(normalizedEmail);
    const emailSent = await emailService.sendVerificationEmail(
      user.email,
      verificationCode,
      'Verifica tu cuenta - LGYM'
    );

    if (!emailSent) {
      return res.status(500).json({ message: 'Error al enviar el codigo de verificacion.' });
    }

    return res.status(200).json({ message: 'Se ha reenviado el codigo de verificacion a tu email.' });
  } catch (error) {
    return handleControllerError(res, 'resendVerification', error, 'Error al procesar la solicitud.');
  }
};

const refreshToken = async (req, res) => {
  try {
    const requesterId = ensureAuthenticatedUserId(req);
    const user = await models.usuarios.findByPk(requesterId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado.' });
    }

    const roleInfo = await loadUserRoleInfo(user.id_usuario);
    const token = signUserToken(user, roleInfo);
    return res.status(200).json({ message: 'Token refrescado', token, role: roleInfo });
  } catch (error) {
    return handleControllerError(res, 'refreshToken', error, 'Error al refrescar token.');
  }
};

const buildModulesFromAssignments = (assignments = []) => {
  const modulesMap = new Map();

  assignments.forEach(({ id_rol_rol: role }) => {
    const detalles = Array.isArray(role?.detallesrols) ? role.detallesrols : [];
    detalles.forEach((detalle) => {
      const permiso = detalle.id_permiso_permiso;
      if (!permiso) return;

      if (!modulesMap.has(permiso.id_permiso)) {
        modulesMap.set(permiso.id_permiso, {
          id_permiso: permiso.id_permiso,
          modulo: permiso.nombre,
          privilegios: new Map()
        });
      }

      const privilegio = detalle.id_privilegio_privilegio;
      if (!privilegio) return;

      modulesMap.get(permiso.id_permiso).privilegios.set(privilegio.id_privilegio, {
        id_privilegio: privilegio.id_privilegio,
        nombre: privilegio.nombre
      });
    });
  });

  return Array.from(modulesMap.values())
    .map((module) => ({
      id_permiso: module.id_permiso,
      modulo: module.modulo,
      privilegios: Array.from(module.privilegios.values())
    }))
    .sort((a, b) => a.id_permiso - b.id_permiso);
};

const getMyModules = async (req, res) => {
  try {
    const requesterId = ensureAuthenticatedUserId(req);
    const access = await ensureAccessControl(req);

    if (access.isAdmin) {
      const [permisos, privilegios] = await Promise.all([
        models.permisos.findAll({ attributes: ['id_permiso', 'nombre'] }),
        models.privilegios.findAll({ attributes: ['id_privilegio', 'nombre'] })
      ]);

      const privilegiosList = privilegios.map((privilegio) => ({
        id_privilegio: privilegio.id_privilegio,
        nombre: privilegio.nombre
      }));

      const modules = permisos.map((permiso) => ({
        id_permiso: permiso.id_permiso,
        modulo: permiso.nombre,
        privilegios: privilegiosList
      }));

      return res.status(200).json({ isAdmin: true, roles: access.roles, modules });
    }

    const assignments = await models.roles_usuarios.findAll({
      where: { id_usuario: requesterId },
      attributes: ['id_rol', 'id_usuario'],
      include: ASSIGNMENTS_INCLUDE
    });

    return res.status(200).json({
      isAdmin: false,
      roles: access.roles,
      modules: buildModulesFromAssignments(assignments)
    });
  } catch (error) {
    return handleControllerError(
      res,
      'getMyModules',
      error,
      'Error al obtener los permisos del usuario.'
    );
  }
};

module.exports = {
  getUsers,
  getClientUsers,
  getNonClientNonAdminUsers,
  getUserById,
  getUserSelf,
  createUser,
  updateUser,
  updateUserSelf,
  deleteUser,
  login,
  resetPassword,
  forgotPassword,
  confirmResetPassword,
  verifyEmail,
  resendVerification,
  refreshToken,
  getMyModules
};
