const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('seguimiento_deportivo', {
    id_seguimiento: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuarios',
        key: 'id_usuario'
      }
    },
    deporte: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    actividad: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    fecha_registro: {
      type: DataTypes.DATEONLY,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'seguimiento_deportivo',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "seguimiento_deportivo_pkey",
        unique: true,
        fields: [
          { name: "id_seguimiento" },
        ]
      },
    ]
  });
};
