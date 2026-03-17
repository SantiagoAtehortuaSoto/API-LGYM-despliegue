require('dotenv').config();
const sequelize = require('../src/database');

const NEW_PERMISSIONS = ['Seguimiento deportivo', 'Asistencia', 'Ventas Membresias'];
const LEGACY_SALES_PERMISSIONS = new Set(['ventas', 'membresias']);
const ADMIN_ROLE_ID = Number(process.env.ADMIN_ROLE_ID || NaN);
const ADMIN_ROLE_NAME = process.env.ADMIN_ROLE_NAME || 'Administrador';

const normalizeName = (value) =>
  (value || '')
    .toString()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const ensurePermisoColumnLength = async (transaction) => {
  await sequelize.query(
    `
    DO $$
    DECLARE current_len integer;
    BEGIN
      SELECT character_maximum_length INTO current_len
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'permisos'
        AND column_name = 'nombre';

      IF current_len IS NULL THEN
        RAISE EXCEPTION 'No existe la columna public.permisos.nombre';
      END IF;

      IF current_len < 60 THEN
        ALTER TABLE public.permisos
          ALTER COLUMN nombre TYPE VARCHAR(60);
      END IF;
    END $$;
    `,
    { transaction }
  );
};

const upsertPermission = async (nombre, transaction) => {
  await sequelize.query(
    `
    INSERT INTO public.permisos (nombre, id_estado)
    VALUES (:nombre, 1)
    ON CONFLICT (nombre)
    DO UPDATE SET id_estado = EXCLUDED.id_estado
    `,
    {
      transaction,
      replacements: { nombre }
    }
  );

  const [rows] = await sequelize.query(
    `
    SELECT id_permiso
    FROM public.permisos
    WHERE nombre = :nombre
    LIMIT 1
    `,
    {
      transaction,
      replacements: { nombre }
    }
  );

  return rows[0]?.id_permiso ? Number(rows[0].id_permiso) : null;
};

const assignRolePrivilege = async ({ idRol, idPermiso, idPrivilegio, transaction }) => {
  await sequelize.query(
    `
    INSERT INTO public.detallesrol (id_rol, id_permiso, id_privilegio)
    VALUES (:idRol, :idPermiso, :idPrivilegio)
    ON CONFLICT (id_rol, id_permiso, id_privilegio)
    DO NOTHING
    `,
    {
      transaction,
      replacements: { idRol, idPermiso, idPrivilegio }
    }
  );
};

async function migrate() {
  const tx = await sequelize.transaction();

  try {
    await ensurePermisoColumnLength(tx);

    const permissionIds = {};
    for (const nombre of NEW_PERMISSIONS) {
      permissionIds[nombre] = await upsertPermission(nombre, tx);
    }

    const [activePrivRows] = await sequelize.query(
      `
      SELECT id_privilegio
      FROM public.privilegios
      WHERE id_estado = 1
      ORDER BY id_privilegio
      `,
      { transaction: tx }
    );

    const activePrivilegioIds = activePrivRows.map((row) => Number(row.id_privilegio));

    const [rolesRows] = await sequelize.query(
      `
      SELECT id_rol, nombre
      FROM public.rol
      WHERE id_estado = 1
      ORDER BY id_rol
      `,
      { transaction: tx }
    );

    const normalizedAdminRoleName = normalizeName(ADMIN_ROLE_NAME);
    const adminRoleIds = new Set(
      rolesRows
        .filter((role) => {
          const idRol = Number(role.id_rol);
          if (Number.isInteger(ADMIN_ROLE_ID) && idRol === ADMIN_ROLE_ID) {
            return true;
          }
          const roleName = normalizeName(role.nombre);
          return roleName === normalizedAdminRoleName || roleName === 'administrador';
        })
        .map((role) => Number(role.id_rol))
    );

    for (const idRol of adminRoleIds) {
      for (const permissionName of NEW_PERMISSIONS) {
        const idPermiso = permissionIds[permissionName];
        for (const idPrivilegio of activePrivilegioIds) {
          await assignRolePrivilege({
            idRol,
            idPermiso,
            idPrivilegio,
            transaction: tx
          });
        }
      }
    }

    const [allPermRows] = await sequelize.query(
      `
      SELECT id_permiso, nombre
      FROM public.permisos
      ORDER BY id_permiso
      `,
      { transaction: tx }
    );

    const legacySalesPermissionIds = allPermRows
      .filter((row) => LEGACY_SALES_PERMISSIONS.has(normalizeName(row.nombre)))
      .map((row) => Number(row.id_permiso));

    const ventasMembresiasId = Number(permissionIds['Ventas Membresias']);

    if (legacySalesPermissionIds.length > 0 && Number.isInteger(ventasMembresiasId)) {
      const [sourceAssignments] = await sequelize.query(
        `
        SELECT DISTINCT id_rol, id_privilegio
        FROM public.detallesrol
        WHERE id_permiso IN (:legacyIds)
        `,
        {
          transaction: tx,
          replacements: { legacyIds: legacySalesPermissionIds }
        }
      );

      for (const row of sourceAssignments) {
        await assignRolePrivilege({
          idRol: Number(row.id_rol),
          idPermiso: ventasMembresiasId,
          idPrivilegio: Number(row.id_privilegio),
          transaction: tx
        });
      }
    }

    await tx.commit();

    console.log('Migration completed: nuevos permisos listos.');
    console.log(
      JSON.stringify(
        {
          permisos_creados: NEW_PERMISSIONS,
          admin_roles_actualizados: Array.from(adminRoleIds),
          privilegios_activos: activePrivilegioIds
        },
        null,
        2
      )
    );
  } catch (error) {
    await tx.rollback();
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
