const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detallesrol', {
    id_detallesrol: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_rol: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'rol',
        key: 'id_rol'
      },
      unique: "uq_detallesrol"
    },
    id_permiso: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'permisos',
        key: 'id_permiso'
      },
      unique: "uq_detallesrol"
    },
    id_privilegio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'privilegios',
        key: 'id_privilegio'
      },
      unique: "uq_detallesrol"
    }
  }, {
    sequelize,
    tableName: 'detallesrol',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detallesrol_pkey",
        unique: true,
        fields: [
          { name: "id_detallesrol" },
        ]
      },
      {
        name: "uq_detallesrol",
        unique: true,
        fields: [
          { name: "id_rol" },
          { name: "id_permiso" },
          { name: "id_privilegio" },
        ]
      },
    ]
  });
};
