const validateCreate = (req, res, next) => {
    const { email, password } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'El email es requerido' });
    }
    if (!password || password.length < 6) {
        return res.status(400).json({ message: 'La contraseña debe tener al menos 6 caracteres' });
    }

    next();
};

const validateLogin = (req, res, next) => {
    const { email, password } = req.body;

    if (!email) {
        return res.status(400).json({ message: 'El email es requerido' });
    }
    if (!password) {
        return res.status(400).json({ message: 'La contraseña es requerida' });
    }

    next();
};

module.exports = {
    validateCreate,
    validateLogin
};