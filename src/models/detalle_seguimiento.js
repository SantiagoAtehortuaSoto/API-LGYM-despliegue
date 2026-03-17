const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detalle_seguimiento', {
    id_detalle_s: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_seguimiento: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'seguimiento_deportivo',
        key: 'id_seguimiento'
      }
    },
    id_relacion_seguimiento: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'relacion_seguimiento_caracteristica',
        key: 'id_relacion_seguimiento'
      }
    },
    valor_numerico: {
      type: DataTypes.DOUBLE,
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'detalle_seguimiento',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detalle_seguimiento_pkey",
        unique: true,
        fields: [
          { name: "id_detalle_s" },
        ]
      },
    ]
  });
};
