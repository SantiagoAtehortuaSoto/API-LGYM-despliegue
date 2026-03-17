const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detalles_detalles', {
    id_detalle_detalles: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_detalle: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'detalles_venta',
        key: 'id_detalle_venta'
      }
    },
    id_membresias: {
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
    id_producto: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'productos',
        key: 'id_productos'
      }
    },
    valor_venta: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    cantidad_parcial: {
      type: DataTypes.INTEGER,
      allowNull: false
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
    tableName: 'detalles_detalles',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detalles_detalles_pkey",
        unique: true,
        fields: [
          { name: "id_detalle_detalles" },
        ]
      },
    ]
  });
};
