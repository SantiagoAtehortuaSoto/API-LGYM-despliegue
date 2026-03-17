const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('membresias', {
    id_membresias: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre_membresia: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    descripcion_membresia: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    precio_de_venta: {
      type: DataTypes.DECIMAL,
      allowNull: false
    },
    duracion_dias: {
      type: DataTypes.INTEGER,
      allowNull: true
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
    tableName: 'membresias',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "membresias_pkey",
        unique: true,
        fields: [
          { name: "id_membresias" },
        ]
      },
    ]
  });
};
