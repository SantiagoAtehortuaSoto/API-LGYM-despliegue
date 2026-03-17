const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('usuarios', {
    id_usuario: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    nombre_usuario: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    apellido_usuario: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    tipo_documento: {
      type: DataTypes.STRING(10),
      allowNull: false
    },
    documento: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: false,
      unique: "usuarios_email_key"
    },
    telefono: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    c_emergencia: {
      type: DataTypes.BIGINT,
      allowNull: false
    },
    n_emergencia: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    fecha_nacimiento: {
      type: DataTypes.DATEONLY,
      allowNull: false
    },
    fecha_registro: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: sequelize.literal('CURRENT_DATE')
    },
    genero: {
      type: DataTypes.STRING(40),
      allowNull: false
    },
    enfermedades: {
      type: DataTypes.STRING(500),
      allowNull: false
    },
    password: {
      type: DataTypes.STRING(80),
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
    tableName: 'usuarios',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "usuarios_email_key",
        unique: true,
        fields: [
          { name: "email" },
        ]
      },
      {
        name: "usuarios_pkey",
        unique: true,
        fields: [
          { name: "id_usuario" },
        ]
      },
    ]
  });
};
