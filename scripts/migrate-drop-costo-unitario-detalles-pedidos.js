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
            AND table_name = 'detalles_pedidos'
            AND column_name = 'costo_unitario'
        ) THEN
          ALTER TABLE public.detalles_pedidos
            DROP COLUMN costo_unitario;
        END IF;
      END $$;
      `,
      { transaction: tx }
    );

    await tx.commit();
    console.log('Migration completed: detalles_pedidos.costo_unitario removed (if it existed).');
  } catch (error) {
    await tx.rollback();
    console.error('Migration failed:', error.message);
    process.exitCode = 1;
  } finally {
    await sequelize.close();
  }
}

migrate();
