const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);

const ADMIN_USER_ID = Number(process.env.ADMIN_USER_ID || NaN);
const CRUD_PRIVS = { GET: 'ver', POST: 'crear', PUT: 'editar', PATCH: 'editar', DELETE: 'eliminar' };

const normalizeName = (value) => {
    if (value === undefined || value === null) {
        return '';
    }
    return value
        .toString()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();
};

const buildEmptyAccess = () => ({
    isAdmin: false,
    roles: [],
    permisoIds: new Set(),
    permisoNames: new Set(),
    permisoIdToName: new Map(),
    permisoNameToId: new Map(),
    privilegioIdToName: new Map(),
    privilegioNameToId: new Map(),
    privilegesByPermisoId: new Map(),
    privilegesByPermisoName: new Map()
});

const loadUserAccess = async (userId) => {
    const assignments = await models.roles_usuarios.findAll({
        where: { id_usuario: userId },
        attributes: ['id_rol', 'id_usuario'],
        include: [
            {
                model: models.rol,
                as: 'id_rol_rol',
                attributes: ['id_rol', 'nombre'],
                include: [
                    {
                        model: models.detallesrol,
                        as: 'detallesrols',
                        attributes: ['id_detallesrol', 'id_permiso', 'id_privilegio'],
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
        ]
    });

    const access = buildEmptyAccess();

    assignments.forEach((assignment) => {
        const rol = assignment.id_rol_rol;
        if (!rol) {
            return;
        }

        // Admin solo por usuario especifico (no por rol, para respetar privilegios configurados)
        if (Number.isInteger(ADMIN_USER_ID) && Number(assignment.id_usuario) === ADMIN_USER_ID) {
            access.isAdmin = true;
        }

        access.roles.push({
            id_rol: rol.id_rol,
            nombre: rol.nombre
        });

        const detalles = Array.isArray(rol.detallesrols) ? rol.detallesrols : [];
        detalles.forEach((detalle) => {
            const permisoId = Number(detalle.id_permiso);
            const privilegioId = Number(detalle.id_privilegio);
            const permisoNombre = normalizeName(detalle?.id_permiso_permiso?.nombre);
            const privilegioNombre = normalizeName(detalle?.id_privilegio_privilegio?.nombre);

            if (Number.isInteger(permisoId)) {
                access.permisoIds.add(permisoId);
            }
            if (permisoNombre) {
                access.permisoNames.add(permisoNombre);
            }
            if (Number.isInteger(permisoId) && permisoNombre) {
                access.permisoIdToName.set(permisoId, permisoNombre);
                if (!access.permisoNameToId.has(permisoNombre)) {
                    access.permisoNameToId.set(permisoNombre, permisoId);
                }
            }

            if (Number.isInteger(privilegioId) && privilegioNombre) {
                access.privilegioIdToName.set(privilegioId, privilegioNombre);
                if (!access.privilegioNameToId.has(privilegioNombre)) {
                    access.privilegioNameToId.set(privilegioNombre, privilegioId);
                }
            }

            if (Number.isInteger(permisoId)) {
                if (!access.privilegesByPermisoId.has(permisoId)) {
                    access.privilegesByPermisoId.set(permisoId, new Set());
                }
                if (Number.isInteger(privilegioId)) {
                    access.privilegesByPermisoId.get(permisoId).add(privilegioId);
                }
            }

            if (permisoNombre) {
                if (!access.privilegesByPermisoName.has(permisoNombre)) {
                    access.privilegesByPermisoName.set(permisoNombre, new Set());
                }
                if (privilegioNombre) {
                    access.privilegesByPermisoName.get(permisoNombre).add(privilegioNombre);
                }
            }
        });
    });

    return access;
};

const ensureAccessControl = async (req) => { 
    if (req.accessControl && req.accessControl.loaded) { 
        return req.accessControl; 
    } 

    if (!req.user || !req.user.id) { 
        const error = new Error('Usuario no autenticado'); 
        error.statusCode = 401; 
        throw error; 
    } 

    const access = await loadUserAccess(req.user.id); 
    // Fallback: solo si el usuario coincide con ADMIN_USER_ID
    if (Number.isInteger(ADMIN_USER_ID) && Number(req.user.id) === ADMIN_USER_ID) {
        access.isAdmin = true;
    }

    const decorated = { ...access, loaded: true }; 
    req.accessControl = decorated; 
    return decorated; 
}; 

const collectValues = (rawValue) => {
    if (rawValue === undefined || rawValue === null) {
        return [];
    }
    return Array.isArray(rawValue) ? rawValue : [rawValue];
};

const normalizeRequirement = (rawRequirement) => {
    if (!rawRequirement) {
        return null;
    }

    if (typeof rawRequirement === 'string') {
        const [permisoParte, privilegioParte] = rawRequirement.split(':');
        const permisos = permisoParte ? [normalizeName(permisoParte)] : [];
        const privilegios = privilegioParte ? [normalizeName(privilegioParte)] : [];
        if (!permisos.length) {
            return null;
        }
        return {
            permisoIds: [],
            permisoNames: permisos.filter(Boolean),
            privilegioIds: [],
            privilegioNames: privilegios.filter(Boolean)
        };
    }

    const permisoIds = new Set();
    const permisoNames = new Set();
    const privilegioIds = new Set();
    const privilegioNames = new Set();

    const addPermisoValue = (value) => {
        collectValues(value).forEach((item) => {
            if (item === undefined || item === null) {
                return;
            }

            const numericValue = Number(item);
            if (Number.isInteger(numericValue)) {
                permisoIds.add(numericValue);
                return;
            }

            if (typeof item === 'string') {
                const normalized = normalizeName(item);
                if (normalized) {
                    permisoNames.add(normalized);
                }
            }
        });
    };

    const addPrivilegioValue = (value) => {
        collectValues(value).forEach((item) => {
            if (item === undefined || item === null) {
                return;
            }

            const numericValue = Number(item);
            if (Number.isInteger(numericValue)) {
                privilegioIds.add(numericValue);
                return;
            }

            if (typeof item === 'string') {
                const normalized = normalizeName(item);
                if (normalized) {
                    privilegioNames.add(normalized);
                }
            }
        });
    };

    addPermisoValue(rawRequirement.id_permiso ?? rawRequirement.idPermiso ?? rawRequirement.permissionId);
    addPermisoValue(rawRequirement.permiso ?? rawRequirement.permission ?? rawRequirement.module ?? rawRequirement.modulo ?? rawRequirement.permisos);

    addPrivilegioValue(rawRequirement.id_privilegio ?? rawRequirement.idPrivilegio ?? rawRequirement.privilegioId ?? rawRequirement.id_privilegios);
    addPrivilegioValue(rawRequirement.privilegio ?? rawRequirement.privilegios ?? rawRequirement.action ?? rawRequirement.actions ?? rawRequirement.privileges);

    if (permisoIds.size === 0 && permisoNames.size === 0) {
        return null;
    }

    return {
        permisoIds: Array.from(permisoIds),
        permisoNames: Array.from(permisoNames),
        privilegioIds: Array.from(privilegioIds),
        privilegioNames: Array.from(privilegioNames)
    };
};

const requirementSatisfied = (access, requirement) => {
    if (!requirement) {
        return false;
    }

    const matchById = requirement.permisoIds.length
        ? requirement.permisoIds.some((permisoId) => {
              if (!access.permisoIds.has(permisoId)) {
                  return false;
              }

              const grantedIds = access.privilegesByPermisoId.get(permisoId);
              const permisoNombre = access.permisoIdToName.get(permisoId);
              const grantedNames = permisoNombre ? access.privilegesByPermisoName.get(permisoNombre) : undefined;

              const idsOk = requirement.privilegioIds.length
                  ? !!(grantedIds && requirement.privilegioIds.some((id) => grantedIds.has(id)))
                  : true;

              const namesOk = requirement.privilegioNames.length
                  ? !!(grantedNames && requirement.privilegioNames.some((name) => grantedNames.has(name)))
                  : true;

              return idsOk && namesOk;
          })
        : false;

    if (matchById) {
        return true;
    }

    const matchByName = requirement.permisoNames.length
        ? requirement.permisoNames.some((permisoNombre) => {
              if (!access.permisoNames.has(permisoNombre)) {
                  return false;
              }

              const grantedNames = access.privilegesByPermisoName.get(permisoNombre);
              const permisoId = access.permisoNameToId.get(permisoNombre);
              const grantedIds = permisoId ? access.privilegesByPermisoId.get(permisoId) : undefined;

              const namesOk = requirement.privilegioNames.length
                  ? !!(grantedNames && requirement.privilegioNames.some((name) => grantedNames.has(name)))
                  : true;

              const idsOk = requirement.privilegioIds.length
                  ? !!(grantedIds && requirement.privilegioIds.some((id) => grantedIds.has(id)))
                  : true;

              return namesOk && idsOk;
          })
        : false;

    return matchByName;
};

const authorize = (...rawRequirements) => {
    const normalizedRequirements = rawRequirements
        .flat()
        .map(normalizeRequirement)
        .filter(Boolean);

    if (!normalizedRequirements.length) {
        throw new Error('authorize requiere al menos un permiso');
    }

    return async (req, res, next) => { 
        try { 
            const access = await ensureAccessControl(req); 
            if (access.isAdmin) { 
                return next(); 
            } 

            const allowed = normalizedRequirements.some((requirement) => 
                requirementSatisfied(access, requirement) 
            ); 

            if (allowed) {
                return next();
            }

            return res
                .status(403)
                .json({ message: 'No cuenta con los permisos necesarios para realizar esta accion' });
        } catch (error) {
            if (error.statusCode) {
                return res.status(error.statusCode).json({ message: error.message });
            }
            console.error('[authorization] error validando permisos:', error);
            return res
                .status(500)
                .json({ message: 'Error interno al validar permisos.' });
        }
    };
};

const buildCrudAuthorizers = (permisoNombre) => ({
    GET: authorize({ permiso: permisoNombre, privilegios: [CRUD_PRIVS.GET] }),
    POST: authorize({ permiso: permisoNombre, privilegios: [CRUD_PRIVS.POST] }),
    PUT: authorize({ permiso: permisoNombre, privilegios: [CRUD_PRIVS.PUT] }),
    PATCH: authorize({ permiso: permisoNombre, privilegios: [CRUD_PRIVS.PATCH] }),
    DELETE: authorize({ permiso: permisoNombre, privilegios: [CRUD_PRIVS.DELETE] }),
    DEFAULT: authorize({ permiso: permisoNombre, privilegios: [CRUD_PRIVS.GET] })
});

const authorizeCrud = (permisoNombre) => {
    if (!permisoNombre) throw new Error('authorizeCrud requiere un permiso');
    const authorizersByVerb = buildCrudAuthorizers(permisoNombre);

    return (req, res, next) => {
        const verb = (req.method || '').toUpperCase();
        const middleware = authorizersByVerb[verb] || authorizersByVerb.DEFAULT;
        return middleware(req, res, next);
    };
};

const buildCrudAnyAuthorizers = (permisos = []) => ({
    GET: authorize(permisos.map((permiso) => ({ permiso, privilegios: [CRUD_PRIVS.GET] }))),
    POST: authorize(permisos.map((permiso) => ({ permiso, privilegios: [CRUD_PRIVS.POST] }))),
    PUT: authorize(permisos.map((permiso) => ({ permiso, privilegios: [CRUD_PRIVS.PUT] }))),
    PATCH: authorize(permisos.map((permiso) => ({ permiso, privilegios: [CRUD_PRIVS.PATCH] }))),
    DELETE: authorize(permisos.map((permiso) => ({ permiso, privilegios: [CRUD_PRIVS.DELETE] }))),
    DEFAULT: authorize(permisos.map((permiso) => ({ permiso, privilegios: [CRUD_PRIVS.GET] })))
});

const authorizeCrudAny = (...permisoNombres) => {
    const permisos = permisoNombres.flat().filter(Boolean);
    if (!permisos.length) throw new Error('authorizeCrudAny requiere al menos un permiso');

    const authorizersByVerb = buildCrudAnyAuthorizers(permisos);

    return (req, res, next) => {
        const verb = (req.method || '').toUpperCase();
        const middleware = authorizersByVerb[verb] || authorizersByVerb.DEFAULT;
        return middleware(req, res, next);
    };
};

module.exports = {
    authorize,
    ensureAccessControl,
    authorizeCrud,
    authorizeCrudAny
};

