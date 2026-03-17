const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('maestro_parametros', {
    id_parametros_s: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    parametro: {
      type: DataTypes.STRING(200),
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'maestro_parametros',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "maestro_parametros_pkey",
        unique: true,
        fields: [
          { name: "id_parametros_s" },
        ]
      },
    ]
  });
};
