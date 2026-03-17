require('dotenv').config();
const sequelize = require('../src/database');

const getLocalToday = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

async function migrate() {
  const tx = await sequelize.transaction();
  try {
    const localToday = getLocalToday();

    await sequelize.query(
      `
      DO $$
      DECLARE col_type text;
      BEGIN
        SELECT data_type INTO col_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'usuarios'
          AND column_name = 'fecha_registro';

        IF col_type IS NULL THEN
          ALTER TABLE public.usuarios
            ADD COLUMN fecha_registro DATE;
        ELSIF col_type <> 'date' THEN
          ALTER TABLE public.usuarios
            ALTER COLUMN fecha_registro TYPE DATE
            USING fecha_registro::date;
        END IF;
      END $$;
      `,
      { transaction: tx }
    );

    await sequelize.query(
      `
      UPDATE public.usuarios
      SET fecha_registro = :localToday
      WHERE fecha_registro IS NULL;
      `,
      {
        transaction: tx,
        replacements: { localToday }
      }
    );

    await sequelize.query(
      `
      ALTER TABLE public.usuarios
        ALTER COLUMN fecha_registro SET DEFAULT CURRENT_DATE,
        ALTER COLUMN fecha_registro SET NOT NULL;
      `,
      { transaction: tx }
    );

    await tx.commit();
    console.log('Migration completed: usuarios.fecha_registro ready.');
  } catch (error) {
    await tx.rollback();
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
