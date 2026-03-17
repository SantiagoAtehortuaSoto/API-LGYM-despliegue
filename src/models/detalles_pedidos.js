const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detalles_pedidos', {
    id_detalle_pedidos: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_pedidos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'compras',
        key: 'id_pedido'
      }
    },
    id_productos: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'productos',
        key: 'id_productos'
      }
    },
    cantidad: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    subtotal: {
      type: DataTypes.DECIMAL,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'detalles_pedidos',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detalles_pedidos_pkey",
        unique: true,
        fields: [
          { name: "id_detalle_pedidos" },
        ]
      },
    ]
  });
};
