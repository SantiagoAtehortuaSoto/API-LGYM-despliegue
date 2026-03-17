const { detalles_membresias } = require('../models/init-models').initModels(require('../database'));

const checkServiceMembership = async (req, res, next) => {
  try {
    const { id } = req.params; // Assuming the service ID is passed as a parameter in the route

    const membershipDetail = await detalles_membresias.findOne({
      where: {
        id_servicio: id,
      },
    });

    if (membershipDetail) {
      return res.status(400).json({ message: 'Cannot delete service because it is associated with a membership.' });
    }

    next();
  } catch (error) {
    console.error('Error checking service membership:', error);
    res.status(500).json({ message: 'Internal server error.' });
  }
};

module.exports = {
  checkServiceMembership,
};
