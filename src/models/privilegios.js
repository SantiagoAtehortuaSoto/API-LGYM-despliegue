const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('privilegios', {
    id_privilegio: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(20),
      allowNull: false,
      unique: "uq_nombre_privilegios"
    },
    id_estado: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      references: {
        model: 'estados',
        key: 'id_estado'
      }
    }
  }, {
    sequelize,
    tableName: 'privilegios',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "privilegios_pkey",
        unique: true,
        fields: [
          { name: "id_privilegio" },
        ]
      },
      {
        name: "uq_nombre_privilegios",
        unique: true,
        fields: [
          { name: "nombre" },
        ]
      },
    ]
  });
};
