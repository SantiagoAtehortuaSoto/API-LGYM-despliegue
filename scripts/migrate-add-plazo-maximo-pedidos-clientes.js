require('dotenv').config();
const sequelize = require('../src/database');

async function migrate() {
  const tx = await sequelize.transaction();
  try {
    await sequelize.query(
      `
      DO $$
      DECLARE col_type text;
      BEGIN
        SELECT data_type INTO col_type
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'pedidos_clientes'
          AND column_name = 'plazo_maximo';

        IF col_type IS NULL THEN
          ALTER TABLE public.pedidos_clientes
            ADD COLUMN plazo_maximo DATE;
        ELSIF col_type <> 'date' THEN
          ALTER TABLE public.pedidos_clientes
            ALTER COLUMN plazo_maximo TYPE DATE
            USING plazo_maximo::date;
        END IF;
      END $$;
      `,
      { transaction: tx }
    );

    await tx.commit();
    console.log('Migration completed: pedidos_clientes.plazo_maximo ready.');
  } catch (error) {
    await tx.rollback();
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
