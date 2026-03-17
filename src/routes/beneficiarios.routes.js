const { Router } = require('express');
const router = Router();

const beneficiariosController = require('../controllers/beneficiarios.controller');
const { auth } = require('../middleware/auth');
const { authorize, authorizeCrud } = require('../middleware/authorization');
const {
    checkBeneficiarioExists,
    validateBeneficiarioCreate,
    validateBeneficiarioUpdate,
    validateBeneficiarioUsuarioParam,
    requireBeneficiariosRequester,
    normalizeBeneficiariosQuery
} = require('../middleware/beneficiarios.validator');

// Se usa el módulo "Clientes" para permisos de gestión de beneficiarios
router.use(auth);

const authorizeBeneficiarioDelete = authorize({ permiso: 'Clientes', privilegios: ['eliminar'] });

const canCancelOwnMembership = (req) => {
    const requesterId = Number(req.user?.id);
    const ownerId = Number(req.beneficiario?.id_usuario);
    const relationId = Number(req.beneficiario?.id_relacion);

    return Number.isInteger(requesterId) &&
        requesterId > 0 &&
        (requesterId === ownerId || requesterId === relationId);
};

const allowBeneficiarioCancellation = (req, res, next) => {
    if (canCancelOwnMembership(req)) {
        return next();
    }

    return authorizeBeneficiarioDelete(req, res, next);
};

router.get(
    '/',
    authorizeCrud('Clientes'),
    beneficiariosController.listBeneficiarios
);
router.get(
    '/usuario/:id_usuario',
    authorizeCrud('Clientes'),
    validateBeneficiarioUsuarioParam,
    beneficiariosController.listBeneficiariosByUsuario
);
router.get(
    '/mios',
    requireBeneficiariosRequester,
    normalizeBeneficiariosQuery,
    beneficiariosController.listBeneficiariosAutenticado
);

router.get(
    '/:id',
    authorizeCrud('Clientes'),
    checkBeneficiarioExists,
    beneficiariosController.getBeneficiarioById
);

router.post(
    '/',
    authorizeCrud('Clientes'),
    validateBeneficiarioCreate,
    beneficiariosController.createBeneficiario
);

router.put(
    '/:id',
    authorizeCrud('Clientes'),
    validateBeneficiarioUpdate,
    beneficiariosController.updateBeneficiario
);
router.patch(
    '/:id',
    authorizeCrud('Clientes'),
    validateBeneficiarioUpdate,
    beneficiariosController.updateBeneficiario
);

router.delete(
    '/:id',
    checkBeneficiarioExists,
    allowBeneficiarioCancellation,
    beneficiariosController.deleteBeneficiario
);

module.exports = router;
