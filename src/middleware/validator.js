const { validationResult } = require('express-validator');

const validateResult = (req, res, next) => {
  try {
    validationResult(req).throw();
    return next(); // Si no hay errores, continúa con el siguiente middleware/controlador
  } catch (err) {
    res.status(400).json({ errors: err.array() });
  }
};

module.exports = { validateResult };
