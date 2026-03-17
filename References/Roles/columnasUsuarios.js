import React from "react";
import { Eye, SquarePen, Trash2 } from "lucide-react";

export const columnasUsuarios = [
  {
    field: "id_usuario",
    label: "ID",
  },
  {
    field: "nombre_completo",
    label: "Nombre Completo",
    Cell: ({ row }) => `${row.nombre_usuario} ${row.apellido_usuario}`,
  },
  {
    field: "tipo_documento",
    label: "Tipo Documento",
  },
  {
    field: "documento",
    label: "Documento",
  },
  {
    field: "estado",
    label: "Estado",
    Cell: ({ value, row, onStatusChange }) => {
      const handleToggle = () => {
        const nuevoEstado = value === "Activo" ? "Inactivo" : "Activo";
        onStatusChange(row, nuevoEstado);
      };

      return React.createElement(
        "button",
        {
          onClick: handleToggle,
          className: `boton-estado ${value === "Activo" ? "activo" : "inactivo"}`,
        },
        value || "Inactivo"
      );
    },
  },
  {
    field: "acciones",
    label: "Acciones",
    Cell: ({ row, onEdit, onView, onDelete }) => (
      <div className="acciones-tabla">
        <button 
          onClick={() => onView(row)} 
          className="boton-accion" 
          title="Ver detalles"
        >
          <Eye size={18} />
        </button>
        <button 
          onClick={() => onEdit(row)} 
          className="boton-accion"
          title="Editar"
        >
          <SquarePen size={18} />
        </button>
        <button 
          onClick={() => onDelete(row)} 
          className="boton-accion peligro"
          title="Eliminar"
        >
          <Trash2 size={18} />
        </button>
      </div>
    ),
  },
];

export default columnasUsuarios;
