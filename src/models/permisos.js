const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('permisos', {
    id_permiso: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre: {
      type: DataTypes.STRING(60),
      allowNull: false,
      unique: "uq_nombre_permisos"
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
    tableName: 'permisos',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "permisos_pkey",
        unique: true,
        fields: [
          { name: "id_permiso" },
        ]
      },
      {
        name: "uq_nombre_permisos",
        unique: true,
        fields: [
          { name: "nombre" },
        ]
      },
    ]
  });
};
