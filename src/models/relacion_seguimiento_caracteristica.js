const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('relacion_seguimiento_caracteristica', {
    id_relacion_seguimiento: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    id_maestro_p: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'maestro_parametros',
        key: 'id_parametros_s'
      }
    },
    id_caracteristica: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'caracteristicas',
        key: 'id_caracteristicas'
      }
    },
    valor: {
      type: DataTypes.DOUBLE,
      allowNull: true
    },
    observaciones: {
      type: DataTypes.STRING(200),
      allowNull: true
    }
  }, {
    sequelize,
    tableName: 'relacion_seguimiento_caracteristica',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "relacion_seguimiento_caracteristica_pkey",
        unique: true,
        fields: [
          { name: "id_relacion_seguimiento" },
        ]
      },
    ]
  });
};
