require('dotenv').config();
const sequelize = require('../src/database');

async function migrate() {
  const tx = await sequelize.transaction();
  try {
    await sequelize.query(
      `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'asistencia_clientes'
            AND column_name = 'id_cita'
        ) THEN
          ALTER TABLE public.asistencia_clientes
            DROP CONSTRAINT IF EXISTS asistencia_clientes_id_cita_fkey;

          ALTER TABLE public.asistencia_clientes
            RENAME COLUMN id_cita TO id_agenda;
        END IF;
      END $$;
      `,
      { transaction: tx }
    );

    await sequelize.query(
      `
      ALTER TABLE public.asistencia_clientes
      DROP CONSTRAINT IF EXISTS asistencia_clientes_id_agenda_fkey;
      `,
      { transaction: tx }
    );

    await sequelize.query(
      `
      ALTER TABLE public.asistencia_clientes
      ADD CONSTRAINT asistencia_clientes_id_agenda_fkey
      FOREIGN KEY (id_agenda)
      REFERENCES public.agenda(id_agenda)
      ON UPDATE CASCADE
      ON DELETE RESTRICT;
      `,
      { transaction: tx }
    );

    await sequelize.query(
      `
      DROP TABLE IF EXISTS public.citas;
      `,
      { transaction: tx }
    );

    await tx.commit();
    console.log('Migration completed: asistencia_clientes now references agenda.');
  } catch (error) {
    await tx.rollback();
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
