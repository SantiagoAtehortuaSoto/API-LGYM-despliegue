const debug = (req, res, next) => {
    console.log('Request body:', req.body);
    next();
};

module.exports = debug;