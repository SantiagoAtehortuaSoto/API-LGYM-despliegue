const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('productos', {
    id_productos: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre_producto: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    categoria: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    descripcion_producto: {
      type: DataTypes.STRING(200),
      allowNull: true
    },
    precio_venta_producto: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    stock: {
      type: DataTypes.INTEGER,
      allowNull: false
    },
    id_estados: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'estados',
        key: 'id_estado'
      }
    },
    imagen_url: {
      type: DataTypes.STRING(255),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'productos',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "productos_pkey",
        unique: true,
        fields: [
          { name: "id_productos" },
        ]
      },
    ]
  });
};
