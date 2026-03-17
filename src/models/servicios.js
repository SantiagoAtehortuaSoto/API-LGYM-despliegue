const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('servicios', {
    id_servicio: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre_servicio: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    descripcion_servicio: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    precio_servicio: {
      type: DataTypes.DECIMAL,
      allowNull: false,
      defaultValue: 1
    },
    tipo_servicio: {
      type: DataTypes.STRING(80),
      allowNull: true
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
    tableName: 'servicios',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "servicios_pkey",
        unique: true,
        fields: [
          { name: "id_servicio" },
        ]
      },
    ]
  });
};
