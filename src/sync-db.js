const sequelize = require('./database');
const initModels = require('./models/init-models');

const normalizeTableName = (table) => {
  if (!table) return '';
  if (typeof table === 'string') return table;
  if (typeof table === 'object') {
    if (table.tableName) return table.tableName;
    if (table.name) return table.name;
  }
  return String(table);
};

const buildSyncOrder = (models) => {
  const modelList = Object.values(models);
  const modelsByTable = new Map();

  for (const model of modelList) {
    const table = normalizeTableName(model.getTableName());
    if (table) {
      modelsByTable.set(table, model);
    }
  }

  const dependencies = new Map();
  const dependents = new Map();

  for (const [table] of modelsByTable) {
    dependencies.set(table, new Set());
    dependents.set(table, new Set());
  }

  for (const [table, model] of modelsByTable) {
    const attrs = Object.values(model.rawAttributes || {});
    for (const attr of attrs) {
      const refModel = attr && attr.references ? attr.references.model : null;
      const refTable = normalizeTableName(refModel);
      if (!refTable) continue;
      if (!modelsByTable.has(refTable)) continue;
      if (refTable === table) continue;

      dependencies.get(table).add(refTable);
      dependents.get(refTable).add(table);
    }
  }

  const inDegree = new Map();
  for (const [table, deps] of dependencies) {
    inDegree.set(table, deps.size);
  }

  const queue = [];
  for (const [table, degree] of inDegree) {
    if (degree === 0) queue.push(table);
  }

  const ordered = [];
  while (queue.length > 0) {
    const table = queue.shift();
    ordered.push(modelsByTable.get(table));
    for (const dep of dependents.get(table)) {
      const nextDegree = inDegree.get(dep) - 1;
      inDegree.set(dep, nextDegree);
      if (nextDegree === 0) {
        queue.push(dep);
      }
    }
  }

  const remaining = [];
  for (const [table, degree] of inDegree) {
    if (degree > 0) {
      remaining.push(modelsByTable.get(table));
    }
  }

  return { ordered, remaining };
};

const syncAll = async ({ alter = true } = {}) => {
  const models = initModels(sequelize);
  const { ordered, remaining } = buildSyncOrder(models);

  for (const model of ordered) {
    const table = normalizeTableName(model.getTableName());
    await model.sync({ alter });
    if (table) {
      console.log(`Synced table: ${table}`);
    }
  }

  if (remaining.length > 0) {
    console.warn('Warning: circular dependencies detected. Syncing remaining tables last.');
    for (const model of remaining) {
      const table = normalizeTableName(model.getTableName());
      await model.sync({ alter });
      if (table) {
        console.log(`Synced table: ${table}`);
      }
    }
  }
};

if (require.main === module) {
  const shouldAlter = process.env.DB_SYNC_ALTER === 'true';
  syncAll({ alter: shouldAlter })
    .then(() => {
      console.log('Database sync completed.');
      return sequelize.close();
    })
    .catch((error) => {
      console.error('Database sync failed:', error && error.message ? error.message : error);
      process.exitCode = 1;
      return sequelize.close();
    });
}

module.exports = { syncAll };
