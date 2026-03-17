const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('proveedores', {
    id_proveedor: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nit_proveedor: {
      type: DataTypes.INTEGER,
      allowNull: false,
      unique: "proveedores_nit_proveedor_key"
    },
    nombre_proveedor: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    telefono_proveedor: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    nombre_contacto: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    email_proveedor: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    direccion_proveedor: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    ciudad_proveedor: {
      type: DataTypes.STRING(80),
      allowNull: true
    },
    fecha_registro: {
      type: DataTypes.DATEONLY,
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
    tableName: 'proveedores',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "proveedores_nit_proveedor_key",
        unique: true,
        fields: [
          { name: "nit_proveedor" },
        ]
      },
      {
        name: "proveedores_pkey",
        unique: true,
        fields: [
          { name: "id_proveedor" },
        ]
      },
    ]
  });
};
