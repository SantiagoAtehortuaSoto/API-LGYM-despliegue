const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('pedidos_clientes', {
    id_pedido_cliente: {
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
    id_estado: {
      type: DataTypes.INTEGER,
      allowNull: true,
      references: {
        model: 'estados',
        key: 'id_estado'
      }
    },
    valor_total_venta: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    fecha_venta: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    plazo_maximo: {
      type: DataTypes.DATEONLY,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'pedidos_clientes',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "pedidos_clientes_pkey",
        unique: true,
        fields: [
          { name: "id_pedido_cliente" },
        ]
      },
    ]
  });
};
