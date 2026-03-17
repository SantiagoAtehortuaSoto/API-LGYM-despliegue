const { Router } = require('express');
const router = Router();
// Importar funciones del controlador
const usuariosController = require('../controllers/usuarios.controller');

// Middlewares importados
const { auth, optionalAuth } = require('../middleware/auth');
const { authorizeCrud } = require('../middleware/authorization');
const { validateResetPasswordFields, validateUpdatePasswordFields } = require('../middleware/password.validator');
const { checkEmailExistsMiddleware, checkDocumentoExistsMiddleware } = require('../middleware/user.middleware');
const {
  validateUserCreate,
  validateUserBirthDateUpdate
} = require('../middleware/userValidator');

// --- Rutas de Autenticación y Registro ---

// Ruta para que un usuario inicie sesión y obtenga un token
router.post('/login', usuariosController.login);


// Rutas para crear usuario (no requieren auth)
router.post('/', optionalAuth, validateUserCreate, usuariosController.createUser);
router.post('/verificar-email', checkEmailExistsMiddleware);
router.post('/verificar-documento', checkDocumentoExistsMiddleware);
router.post('/check-email', checkEmailExistsMiddleware); // alias para front antiguo
router.post('/check-documento', checkDocumentoExistsMiddleware);
router.post('/check-document', checkDocumentoExistsMiddleware);
router.get('/check-email', checkEmailExistsMiddleware);
router.get('/check-documento', checkDocumentoExistsMiddleware);
router.get('/check-document', checkDocumentoExistsMiddleware);

// Olvidar contraseña
// Paso 1: Solicitar código de verificación (solo requiere email)
router.post('/forgot-password', usuariosController.forgotPassword);

// Paso 2: Confirmar código y cambiar contraseña
router.post('/reset-password', validateResetPasswordFields, usuariosController.confirmResetPassword);

// Verificar email de cuenta (registro)
router.post('/verify-email', usuariosController.verifyEmail);

// Reenviar codigo de verificacion de cuenta
router.post('/resend-verification', usuariosController.resendVerification);

// Ruta para cambiar contraseña estando autenticado
router.post('/change-password', [auth, validateUpdatePasswordFields], usuariosController.resetPassword);

// Refrescar token para obtener rol actualizado 
router.post('/refresh-token', auth, usuariosController.refreshToken); 
// Modulos/acciones disponibles para el usuario autenticado (para sidebar) 
router.get('/me/permisos', auth, usuariosController.getMyModules); 
// Perfil del usuario autenticado (sin permisos de módulo) 
router.get('/me', auth, usuariosController.getUserSelf); 
// Actualizar perfil del usuario autenticado 
router.put('/me', auth, validateUserBirthDateUpdate, usuariosController.updateUserSelf); 


// --- Rutas Protegidas --- 
// El resto de rutas sí requieren un token de autenticación.

router.get(
    '/',
    auth,
    authorizeCrud('Usuarios'),
    usuariosController.getUsers
);
router.get(
    '/clientes',
    auth,
    authorizeCrud('Usuarios'),
    usuariosController.getClientUsers
);
router.get(
    '/no-clientes',
    auth,
    authorizeCrud('Usuarios'),
    usuariosController.getNonClientNonAdminUsers
);
router.get(
    '/:id',
    auth,
    authorizeCrud('Usuarios'),
    usuariosController.getUserById
);
router.put(
    '/:id',
    auth,
    authorizeCrud('Usuarios'),
    validateUserBirthDateUpdate,
    usuariosController.updateUser
);
router.delete(
    '/:id',
    auth,
    authorizeCrud('Usuarios'),
    usuariosController.deleteUser
);

module.exports = router;

