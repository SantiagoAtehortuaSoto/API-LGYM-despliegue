const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('empleados', {
    id_empleado: {
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
      },
      unique: "uq_empleados_id_usuario"
    },
    direccion_empleado: {
      type: DataTypes.STRING(200),
      allowNull: false
    },
    cargo: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    fecha_contratacion: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    salario: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    horario_empleado: {
      type: DataTypes.STRING(20),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'empleados',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "empleados_pkey",
        unique: true,
        fields: [
          { name: "id_empleado" },
        ]
      },
      {
        name: "uq_empleados_id_usuario",
        unique: true,
        fields: [
          { name: "id_usuario" },
        ]
      },
    ]
  });
};
