const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('asistencia_empleado', {
    id_asistencia_empleado: {
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
    asistencia_fecha: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    hora_entrada_empleado: {
      type: DataTypes.TIME,
      allowNull: true
    },
    hora_salida_empleado: {
      type: DataTypes.TIME,
      allowNull: true
    },
    id_estado: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'estados',
        key: 'id_estado'
      }
    },
    observaciones: {
      type: DataTypes.STRING(200),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'asistencia_empleado',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "asistencia_empleado_pkey",
        unique: true,
        fields: [
          { name: "id_asistencia_empleado" },
        ]
      },
    ]
  });
};
