const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('caracteristicas', {
    id_caracteristicas: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    propiedad: {
      type: DataTypes.STRING(200),
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'caracteristicas',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "caracteristicas_pkey",
        unique: true,
        fields: [
          { name: "id_caracteristicas" },
        ]
      },
    ]
  });
};
