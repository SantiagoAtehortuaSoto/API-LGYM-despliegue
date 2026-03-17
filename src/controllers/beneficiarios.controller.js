const { Op } = require('sequelize');
const initModels = require('../models/init-models');
const sequelize = require('../database');
const models = initModels(sequelize);

const CLIENT_ROLE_ID = Number(process.env.CLIENT_ROLE_ID || process.env.DEFAULT_ROLE_ID || 1);
const EXTRA_ROLE_IDS = [33];
const ALLOWED_ROLES = Array.from(new Set([CLIENT_ROLE_ID, ...EXTRA_ROLE_IDS]));

const MEMBERSHIP_STATE_ACTIVE_ID = 1;
const DEFAULT_MEMBERSHIP_DURATION_DAYS = Number(process.env.DEFAULT_MEMBERSHIP_DURATION_DAYS || 30);

const includeConfig = [
    {
        model: models.usuarios,
        as: 'id_usuario_usuario',
        attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email'],
        include: [
            {
                model: models.roles_usuarios,
                as: 'roles_usuarios',
                attributes: ['id_rol'],
                required: false
            }
        ]
    },
    {
        model: models.usuarios,
        as: 'id_relacion_usuario',
        attributes: ['id_usuario', 'nombre_usuario', 'apellido_usuario', 'email'],
        include: [
            {
                model: models.roles_usuarios,
                as: 'roles_usuarios',
                attributes: ['id_rol'],
                required: false
            }
        ]
    },
    {
        model: models.membresias,
        as: 'id_membresia_membresia',
        attributes: ['id_membresias', 'nombre_membresia', 'descripcion_membresia', 'duracion_dias', 'id_estado'],
        include: [
            {
                model: models.detalles_membresias,
                as: 'detalles_membresia',
                include: [
                    {
                        model: models.servicios,
                        as: 'id_servicio_servicio'
                    }
                ]
            }
        ]
    },
    {
        model: models.estados,
        as: 'id_estado_membresia_estado',
        attributes: ['id_estado', 'estado']
    }
];

// Extrae servicios listos para el front
const extractServiciosFromMembresia = (membresia = {}) => {
    const detalles = Array.isArray(membresia.detalles_membresia) ? membresia.detalles_membresia : [];
    return detalles.map((d) => d?.id_servicio_servicio).filter(Boolean);
};

const normalizeBeneficiarioOutput = (row) => {
    if (!row) return row;
    const plain = typeof row.toJSON === 'function' ? row.toJSON() : row;
    const memb = plain.id_membresia_membresia;
    if (memb) {
        const servicios = extractServiciosFromMembresia(memb);
        return {
            ...plain,
            id_membresia_membresia: {
                ...memb,
                servicios
            },
            servicios_membresia: servicios,
            servicios
        };
    }
    return plain;
};

const userHasAllowedRole = (user = {}) => {
    const roles = Array.isArray(user.roles_usuarios) ? user.roles_usuarios : [];
    return roles.some((r) => ALLOWED_ROLES.includes(Number(r.id_rol)));
};

const getLocalToday = () => {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const addDaysToDateOnly = (dateOnly, daysToAdd = 0) => {
    if (!dateOnly) return null;
    const [year, month, day] = String(dateOnly).split('-').map(Number);
    if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
        return null;
    }
    const base = new Date(year, month - 1, day);
    if (Number.isNaN(base.getTime())) {
        return null;
    }
    base.setDate(base.getDate() + Number(daysToAdd || 0));
    const y = base.getFullYear();
    const m = String(base.getMonth() + 1).padStart(2, '0');
    const d = String(base.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
};

const normalizeDurationDays = (value) => {
    const parsed = Number(value);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const resolveMembershipDurationDays = async ({ id_membresia, transaction, durationCache = null }) => {
    const membershipId = Number(id_membresia);
    if (!Number.isInteger(membershipId) || membershipId <= 0) return null;

    if (durationCache && durationCache.has(membershipId)) {
        return durationCache.get(membershipId);
    }

    const membership = await models.membresias.findByPk(membershipId, {
        attributes: ['id_membresias', 'duracion_dias'],
        transaction
    });
    if (!membership) return null;

    const fallbackDuration = Number.isInteger(DEFAULT_MEMBERSHIP_DURATION_DAYS) && DEFAULT_MEMBERSHIP_DURATION_DAYS > 0
        ? DEFAULT_MEMBERSHIP_DURATION_DAYS
        : 30;
    const duration = normalizeDurationDays(membership.duracion_dias) ?? fallbackDuration;

    if (durationCache) {
        durationCache.set(membershipId, duration);
    }

    return duration;
};

// Busca la membresia activa (self) del usuario
const findActiveMembershipIdForUser = async (id_usuario, transaction) => {
    if (!Number.isInteger(id_usuario) || id_usuario <= 0) return null;
    const active = await models.detalles_cliente_beneficiarios.findOne({
        where: {
            id_usuario,
            id_relacion: id_usuario,
            id_estado_membresia: MEMBERSHIP_STATE_ACTIVE_ID
        },
        order: [['id_beneficiario', 'DESC']],
        transaction
    });
    return active ? active.id_membresia : null;
};

const resolveMembershipId = async ({ id_usuario, id_relacion, id_membresia, transaction }) => {
    const ownerId = Number(id_usuario);
    const relationId = Number(id_relacion);

    if (!Number.isInteger(ownerId) || ownerId <= 0) return null;
    if (!Number.isInteger(relationId) || relationId <= 0) return null;

    // Regla de negocio: si es beneficiario (no self), siempre hereda membresia activa del titular.
    if (ownerId !== relationId) {
        return findActiveMembershipIdForUser(ownerId, transaction);
    }

    const parsed = Number(id_membresia);
    if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
    }
    return findActiveMembershipIdForUser(ownerId, transaction);
};

const replaceMembershipRowForPair = async ({
    id_usuario,
    id_relacion,
    id_membresia,
    transaction,
    durationCache = null
}) => {
    await models.detalles_cliente_beneficiarios.destroy({
        where: { id_usuario, id_relacion },
        transaction
    });

    const fechaAsignacion = getLocalToday();
    const durationDays = await resolveMembershipDurationDays({
        id_membresia,
        transaction,
        durationCache
    });
    if (!durationDays) {
        return null;
    }
    const fechaVencimiento = addDaysToDateOnly(fechaAsignacion, durationDays);
    if (!fechaVencimiento) {
        return null;
    }

    return models.detalles_cliente_beneficiarios.create(
        {
            id_usuario,
            id_relacion,
            id_membresia,
            id_estado_membresia: MEMBERSHIP_STATE_ACTIVE_ID,
            fecha_asignacion: fechaAsignacion,
            fecha_vencimiento: fechaVencimiento
        },
        { transaction }
    );
};

const syncOwnerMembershipToBeneficiarios = async ({ id_usuario, id_membresia, transaction }) => {
    const ownerId = Number(id_usuario);
    const membershipId = Number(id_membresia);
    if (!Number.isInteger(ownerId) || ownerId <= 0) return;
    if (!Number.isInteger(membershipId) || membershipId <= 0) return;

    const rows = await models.detalles_cliente_beneficiarios.findAll({
        where: {
            id_usuario: ownerId,
            id_relacion: { [Op.ne]: ownerId }
        },
        attributes: ['id_relacion'],
        transaction
    });

    const relationIds = [
        ...new Set(
            rows
                .map((row) => Number(row.id_relacion))
                .filter((relationId) => Number.isInteger(relationId) && relationId > 0)
        )
    ];

    const durationCache = new Map();
    for (const relationId of relationIds) {
        await replaceMembershipRowForPair({
            id_usuario: ownerId,
            id_relacion: relationId,
            id_membresia: membershipId,
            transaction,
            durationCache
        });
    }
};

const clearBeneficiaryAssignments = async ({ relationId, keepOwnerId = null, transaction }) => {
    const relId = Number(relationId);
    if (!Number.isInteger(relId) || relId <= 0) return;

    const where = { id_relacion: relId };
    const keepId = Number(keepOwnerId);
    if (Number.isInteger(keepId) && keepId > 0) {
        where.id_usuario = { [Op.ne]: keepId };
    }

    await models.detalles_cliente_beneficiarios.destroy({ where, transaction });
};

const listBeneficiarios = async (_req, res) => {
    try {
        const rows = await models.detalles_cliente_beneficiarios.findAll({ include: includeConfig });
        const filtered = rows.filter((row) => {
            const usuario = row?.id_usuario_usuario;
            const relacion = row?.id_relacion_usuario;
            return userHasAllowedRole(usuario) || userHasAllowedRole(relacion);
        });
        res.status(200).json(filtered.map(normalizeBeneficiarioOutput));
    } catch (error) {
        console.error('[Beneficiarios][list] error:', error);
        res.status(500).json({ message: 'Error al obtener beneficiarios', error: error.message });
    }
};

const listBeneficiariosByUsuario = async (req, res) => {
    const id_usuario = Number(req.targetUsuarioId ?? req.params.id_usuario);
    try {
        const rows = await models.detalles_cliente_beneficiarios.findAll({
            where: { id_usuario },
            include: includeConfig
        });
        res.status(200).json(rows.map(normalizeBeneficiarioOutput));
    } catch (error) {
        console.error('[Beneficiarios][listByUsuario] error:', error);
        res.status(500).json({ message: 'Error al obtener beneficiarios', error: error.message });
    }
};

const listBeneficiariosAutenticado = async (req, res) => {
    const requesterId = Number(req.requesterId ?? req.user?.id);
    try {
        const onlySelf = req.onlySelf === true;
        const onlyActive = req.onlyActive === true;

        const where = onlySelf
            ? { id_usuario: requesterId, id_relacion: requesterId }
            : {
                  [Op.or]: [{ id_usuario: requesterId }, { id_relacion: requesterId }]
              };
        if (onlyActive) {
            where.id_estado_membresia = MEMBERSHIP_STATE_ACTIVE_ID;
        }

        const rows = await models.detalles_cliente_beneficiarios.findAll({
            where,
            include: includeConfig
        });
        res.status(200).json(rows.map(normalizeBeneficiarioOutput));
    } catch (error) {
        console.error('[Beneficiarios][listAutenticado] error:', error);
        res.status(500).json({ message: 'Error al obtener tus beneficiarios', error: error.message });
    }
};

const getBeneficiarioById = (req, res) => {
    res.status(200).json(normalizeBeneficiarioOutput(req.beneficiario));
};

const createBeneficiario = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const { id_usuario, id_relacion, id_membresia } = req.body;
        const ownerId = Number(id_usuario);
        const relationId = Number(id_relacion);

        const membershipId = await resolveMembershipId({
            id_usuario: ownerId,
            id_relacion: relationId,
            id_membresia,
            transaction
        });
        if (!membershipId) {
            await transaction.rollback();
            return res.status(400).json({
                message:
                    ownerId !== relationId
                        ? 'El titular no tiene una membresia activa para asignar al beneficiario'
                        : 'El usuario no tiene una membresia activa para asignar'
            });
        }

        // Regla de negocio: un usuario no puede quedar asociado como beneficiario de multiples titulares
        // ni mantener su fila self si ahora sera beneficiario de otro titular.
        await clearBeneficiaryAssignments({
            relationId,
            keepOwnerId: ownerId,
            transaction
        });

        const durationCache = new Map();
        const result = await replaceMembershipRowForPair({
            id_usuario: ownerId,
            id_relacion: relationId,
            id_membresia: membershipId,
            transaction,
            durationCache
        });
        if (!result) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'No se pudo calcular vencimiento para la membresia seleccionada'
            });
        }

        if (ownerId === relationId) {
            await syncOwnerMembershipToBeneficiarios({
                id_usuario: ownerId,
                id_membresia: membershipId,
                transaction
            });
        }

        const withRelations = await models.detalles_cliente_beneficiarios.findByPk(result.id_beneficiario, {
            include: includeConfig,
            transaction
        });
        const payload = withRelations ?? result;
        await transaction.commit();
        res.status(201).json(normalizeBeneficiarioOutput(payload));
    } catch (error) {
        if (transaction && transaction.finished !== 'commit') {
            await transaction.rollback();
        }
        console.error('[Beneficiarios][create] error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                message: 'Ya existe esta relacion de beneficiario para la membresia',
                detail: error.errors?.[0]?.message
            });
        }
        res.status(500).json({ message: 'Error al crear beneficiario', error: error.message });
    }
};

const updateBeneficiario = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const targetUsuario = Number(req.body.id_usuario ?? req.beneficiario.id_usuario);
        const targetRelacion = Number(req.body.id_relacion ?? req.beneficiario.id_relacion);
        const targetMembresia = req.body.id_membresia ?? req.beneficiario.id_membresia;

        const membershipId = await resolveMembershipId({
            id_usuario: targetUsuario,
            id_relacion: targetRelacion,
            id_membresia: targetMembresia,
            transaction
        });
        if (!membershipId) {
            await transaction.rollback();
            return res.status(400).json({
                message:
                    targetUsuario !== targetRelacion
                        ? 'El titular no tiene una membresia activa para asignar al beneficiario'
                        : 'El usuario no tiene una membresia activa para asignar'
            });
        }

        await clearBeneficiaryAssignments({
            relationId: targetRelacion,
            keepOwnerId: targetUsuario,
            transaction
        });

        await models.detalles_cliente_beneficiarios.destroy({
            where: { id_beneficiario: req.beneficiario.id_beneficiario },
            transaction
        });

        const durationCache = new Map();
        const result = await replaceMembershipRowForPair({
            id_usuario: targetUsuario,
            id_relacion: targetRelacion,
            id_membresia: membershipId,
            transaction,
            durationCache
        });
        if (!result) {
            await transaction.rollback();
            return res.status(400).json({
                message: 'No se pudo calcular vencimiento para la membresia seleccionada'
            });
        }

        if (targetUsuario === targetRelacion) {
            await syncOwnerMembershipToBeneficiarios({
                id_usuario: targetUsuario,
                id_membresia: membershipId,
                transaction
            });
        }

        const withRelations = await models.detalles_cliente_beneficiarios.findByPk(result.id_beneficiario, {
            include: includeConfig,
            transaction
        });
        const payload = withRelations ?? result;
        await transaction.commit();
        res.status(200).json(normalizeBeneficiarioOutput(payload));
    } catch (error) {
        if (transaction && transaction.finished !== 'commit') {
            await transaction.rollback();
        }
        console.error('[Beneficiarios][update] error:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            return res.status(400).json({
                message: 'Ya existe esta relacion de beneficiario para la membresia',
                detail: error.errors?.[0]?.message
            });
        }
        res.status(500).json({ message: 'Error al actualizar beneficiario', error: error.message });
    }
};

const deleteBeneficiario = async (req, res) => {
    const transaction = await sequelize.transaction();
    try {
        const ownerId = Number(req.beneficiario?.id_usuario);
        const relationId = Number(req.beneficiario?.id_relacion);
        const isOwnerSelfMembership =
            Number.isInteger(ownerId) &&
            ownerId > 0 &&
            ownerId === relationId;

        const where = isOwnerSelfMembership
            ? { id_usuario: ownerId }
            : { id_beneficiario: req.beneficiario.id_beneficiario };

        const deletedRows = await models.detalles_cliente_beneficiarios.destroy({
            where,
            transaction
        });

        await transaction.commit();
        res.status(200).json({
            message: isOwnerSelfMembership
                ? 'Membresia cancelada para el titular y sus beneficiarios'
                : 'Membresia cancelada para el beneficiario',
            deletedRows
        });
    } catch (error) {
        if (transaction && transaction.finished !== 'commit') {
            await transaction.rollback();
        }
        console.error('[Beneficiarios][delete] error:', error);
        res.status(500).json({ message: 'Error al eliminar beneficiario', error: error.message });
    }
};

module.exports = {
    listBeneficiarios,
    listBeneficiariosByUsuario,
    listBeneficiariosAutenticado,
    getBeneficiarioById,
    createBeneficiario,
    updateBeneficiario,
    deleteBeneficiario
};
