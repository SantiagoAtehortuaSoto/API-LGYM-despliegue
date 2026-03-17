const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('detalles_cliente_beneficiarios', {
    id_beneficiario: {
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
      },
      unique: "uq_benef_usuario_relacion_membresia"
    },
    id_relacion: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'usuarios',
        key: 'id_usuario'
      },
      unique: "uq_benef_usuario_relacion_membresia"
    },
    id_membresia: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: 'membresias',
        key: 'id_membresias'
      },
      unique: "uq_benef_usuario_relacion_membresia"
    },
    id_estado_membresia: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
      references: {
        model: 'estados',
        key: 'id_estado'
      }
    },
    fecha_asignacion: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_DATE')
    },
    fecha_vencimiento: {
      type: DataTypes.DATEONLY,
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'detalles_cliente_beneficiarios',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "detalles_cliente_beneficiarios_pkey",
        unique: true,
        fields: [
          { name: "id_beneficiario" },
        ]
      },
      {
        name: "uq_benef_usuario_relacion_membresia",
        unique: true,
        fields: [
          { name: "id_usuario" },
          { name: "id_relacion" },
          { name: "id_membresia" },
        ]
      },
    ]
  });
};
