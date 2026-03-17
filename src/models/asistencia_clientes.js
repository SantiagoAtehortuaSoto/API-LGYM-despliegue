const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('asistencia_clientes', {
    id_asistencia_clientes: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_agenda: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'agenda',
        key: 'id_agenda'
      }
    },
    id_usuario: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuarios',
        key: 'id_usuario'
      }
    },
    fecha_asistencia: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    hora_ingreso: {
      type: DataTypes.TIME,
      allowNull: false
    },
    hora_salida: {
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
    }
  }, {
    sequelize,
    tableName: 'asistencia_clientes',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "asistencia_clientes_pkey",
        unique: true,
        fields: [
          { name: "id_asistencia_clientes" },
        ]
      },
    ]
  });
};
