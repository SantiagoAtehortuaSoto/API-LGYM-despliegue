const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('compras', {
    id_pedido: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    numero_pedido: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: "uq_numero_pedido"
    },
    id_proveedor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'proveedores',
        key: 'id_proveedor'
      }
    },
    fecha_pedido: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: Sequelize.Sequelize.literal('CURRENT_DATE')
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
    tableName: 'compras',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "compras_pkey",
        unique: true,
        fields: [
          { name: "id_pedido" },
        ]
      },
      {
        name: "uq_numero_pedido",
        unique: true,
        fields: [
          { name: "numero_pedido" },
        ]
      },
    ]
  });
};
