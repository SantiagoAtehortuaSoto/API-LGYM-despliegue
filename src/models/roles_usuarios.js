const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('roles_usuarios', {
    id_rol_usuario: {
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
      unique: "uq_rol_usuario"
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuarios',
        key: 'id_usuario'
      },
      unique: "uq_rol_usuario"
    }
  }, {
    sequelize,
    tableName: 'roles_usuarios',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "roles_usuarios_pkey",
        unique: true,
        fields: [
          { name: "id_rol_usuario" },
        ]
      },
      {
        name: "uq_rol_usuario",
        unique: true,
        fields: [
          { name: "id_rol" },
          { name: "id_usuario" },
        ]
      },
    ]
  });
};
