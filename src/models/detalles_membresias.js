const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detalles_membresias', {
    id_detalle_membresias: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_membresia: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'membresias',
        key: 'id_membresias'
      }
    },
    id_servicio: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'servicios',
        key: 'id_servicio'
      }
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
    tableName: 'detalles_membresias',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detalles_membresias_pkey",
        unique: true,
        fields: [
          { name: "id_detalle_membresias" },
        ]
      },
    ]
  });
};
