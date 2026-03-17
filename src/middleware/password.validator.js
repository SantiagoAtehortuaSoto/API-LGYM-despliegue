const emailService = require('../services/email.service');
const normalizeEmail = require('../utils/normalizeEmail');

const validateResetPasswordFields = (req, res, next) => {
  const normalizedEmail = normalizeEmail(req.body?.email);
  const resetCode = req.body?.resetcode ?? req.body?.resetCode;
  const newPassword = req.body?.newPassword;

  if (!normalizedEmail || !resetCode || !newPassword) {
    return res.status(400).json({
      message: 'Email, resetcode y nueva contrasena son requeridos.'
    });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({
      message: 'La nueva contrasena debe tener al menos 6 caracteres.'
    });
  }

  const isCodeValid = emailService.verifyResetPasswordCode(normalizedEmail, resetCode);
  if (!isCodeValid) {
    return res.status(400).json({ message: 'Codigo invalido o expirado.' });
  }

  req.body.email = normalizedEmail;
  req.body.resetcode = resetCode;
  return next();
};

const validateUpdatePasswordFields = (req, res, next) => {
  const oldPassword = req.body?.oldPassword;
  const newPassword = req.body?.newPassword;

  if (!oldPassword || !newPassword) {
    return res.status(400).json({
      message: 'Se requiere la contrasena anterior y la nueva contrasena.'
    });
  }

  if (typeof newPassword !== 'string' || newPassword.length < 6) {
    return res.status(400).json({
      message: 'La nueva contrasena debe tener al menos 6 caracteres.'
    });
  }

  return next();
};

module.exports = {
  validateResetPasswordFields,
  validateUpdatePasswordFields
};
