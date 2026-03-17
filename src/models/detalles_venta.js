const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detalles_venta', {
    id_detalle_venta: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_pedido_cliente: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'pedidos_clientes',
        key: 'id_pedido_cliente'
      }
    },
    tipo_venta: {
      type: DataTypes.STRING(20),
      allowNull: false
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    perdidas_o_ganancias: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false
    },
    id_producto: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'productos',
        key: 'id_productos'
      }
    },
    id_membresia: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'membresias',
        key: 'id_membresias'
      }
    },
    id_servicio: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'servicios',
        key: 'id_servicio'
      }
    },
    valor_unitario: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
      defaultValue: 0
    },
    subtotal: {
      type: DataTypes.DECIMAL(10,2),
      allowNull: false,
      defaultValue: 0
    }
  }, {
    sequelize,
    tableName: 'detalles_venta',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detalles_venta_pkey",
        unique: true,
        fields: [
          { name: "id_detalle_venta" },
        ]
      },
    ]
  });
};
