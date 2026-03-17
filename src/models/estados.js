const Sequelize = require('sequelize');
module.exports = function(sequelize, DataTypes) {
  return sequelize.define('estados', {
    id_estado: {
      autoIncrement: true,
      type: DataTypes.INTEGER,
      allowNull: false,
      primaryKey: true
    },
    estado: {
      type: DataTypes.STRING(80),
      allowNull: false
    },
    descripcion: {
      type: DataTypes.STRING(200),
      allowNull: false
    }
  }, {
    sequelize,
    tableName: 'estados',
    schema: 'public',
    timestamps: false,
    indexes: [
      {
        name: "estados_pkey",
        unique: true,
        fields: [
          { name: "id_estado" },
        ]
      },
    ]
  });
};
