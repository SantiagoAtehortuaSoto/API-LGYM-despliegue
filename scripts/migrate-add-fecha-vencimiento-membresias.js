require('dotenv').config();
const sequelize = require('../src/database');
const DEFAULT_MEMBERSHIP_DURATION_DAYS = Number(process.env.DEFAULT_MEMBERSHIP_DURATION_DAYS || 30);

async function migrate() {
  const tx = await sequelize.transaction();
  try {
    await sequelize.query(
      `
      DO $$
      DECLARE col_asignacion_type text;
      DECLARE col_vencimiento_type text;
      BEGIN
        SELECT data_type INTO col_asignacion_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'detalles_cliente_beneficiarios'
          AND column_name = 'fecha_asignacion';

        IF col_asignacion_type IS NULL THEN
          ALTER TABLE public.detalles_cliente_beneficiarios
            ADD COLUMN fecha_asignacion DATE;
        ELSIF col_asignacion_type <> 'date' THEN
          ALTER TABLE public.detalles_cliente_beneficiarios
            ALTER COLUMN fecha_asignacion TYPE DATE
            USING fecha_asignacion::date;
        END IF;

        SELECT data_type INTO col_vencimiento_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'detalles_cliente_beneficiarios'
          AND column_name = 'fecha_vencimiento';

        IF col_vencimiento_type IS NULL THEN
          ALTER TABLE public.detalles_cliente_beneficiarios
            ADD COLUMN fecha_vencimiento DATE;
        ELSIF col_vencimiento_type <> 'date' THEN
          ALTER TABLE public.detalles_cliente_beneficiarios
            ALTER COLUMN fecha_vencimiento TYPE DATE
            USING fecha_vencimiento::date;
        END IF;
      END $$;
      `,
      { transaction: tx }
    );

    await sequelize.query(
      `
      UPDATE public.detalles_cliente_beneficiarios
      SET fecha_asignacion = CURRENT_DATE
      WHERE fecha_asignacion IS NULL;
      `,
      { transaction: tx }
    );

    await sequelize.query(
      `
      UPDATE public.detalles_cliente_beneficiarios dcb
      SET fecha_vencimiento = (
        dcb.fecha_asignacion
        + (
          GREATEST(COALESCE(m.duracion_dias, :defaultDuration), 1) * INTERVAL '1 day'
        )
      )::date
      FROM public.membresias m
      WHERE m.id_membresias = dcb.id_membresia;
      `,
      {
        transaction: tx,
        replacements: { defaultDuration: Number.isInteger(DEFAULT_MEMBERSHIP_DURATION_DAYS) && DEFAULT_MEMBERSHIP_DURATION_DAYS > 0 ? DEFAULT_MEMBERSHIP_DURATION_DAYS : 30 }
      }
    );

    await sequelize.query(
      `
      ALTER TABLE public.detalles_cliente_beneficiarios
        ALTER COLUMN fecha_asignacion SET DEFAULT CURRENT_DATE,
        ALTER COLUMN fecha_asignacion SET NOT NULL;
      `,
      { transaction: tx }
    );

    await sequelize.query(
      `
      ALTER TABLE public.detalles_cliente_beneficiarios
        ALTER COLUMN fecha_vencimiento DROP DEFAULT,
        ALTER COLUMN fecha_vencimiento SET NOT NULL;
      `,
      { transaction: tx }
    );

    await sequelize.query(
      `
      CREATE INDEX IF NOT EXISTS idx_detalles_cliente_beneficiarios_fecha_vencimiento
      ON public.detalles_cliente_beneficiarios (fecha_vencimiento);
      `,
      { transaction: tx }
    );

    // Limpieza inicial de relaciones ya vencidas
    await sequelize.query(
      `
      DELETE FROM public.detalles_cliente_beneficiarios
      WHERE fecha_vencimiento < CURRENT_DATE;
      `,
      { transaction: tx }
    );

    await tx.commit();
    console.log('Migration completed: detalles_cliente_beneficiarios with expiration dates ready.');
  } catch (error) {
    await tx.rollback();
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
