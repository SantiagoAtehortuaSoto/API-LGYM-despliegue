// src/pages/lo-que-sea/Roles.jsx
import { useMemo, useState } from "react";
import { Users, Plus } from "lucide-react";
import toast from "react-hot-toast";

import BuscadorUniversal from "../../../components/BuscadorUniversal";
import DataTable from "../../../components/dataTables/dataTable";

import { useRoles } from "../../../hooks/Roles_API/role_API_AD.jsx";
import {
  ModalCrearRol,
  ModalVerRol,
  ModalEditarRol,
  ModalEliminarRol,
} from "./modalRoles";

import { columnasRoles } from "../../../../../shared/utils/data/ejemploRoles.jsx";
import "../../../../../shared/styles/buscadorUniversal.css";
import "../../../../../shared/styles/dashboard.css";

function Roles() {
  const {
    roles,
    loading,
    error,
    crearRol,
    actualizarRol,
    actualizarEstado,
    eliminarRol,
    permisosListos,
    permisoHelpers,
  } = useRoles();

  const [searchTerm, setSearchTerm] = useState("");
  const [filtro, setFiltro] = useState("");
  const [accionModal, setAccionModal] = useState(null); // "crear" | "ver" | "editar" | "eliminar" | null
  const [rolSeleccionado, setRolSeleccionado] = useState(null);

  const handleSearchChange = (e) => {
    const value = e.target.value;
    setFiltro(value);
    setSearchTerm(value);
  };

  if (error) {
    // evita spamear, pero al menos muestra algo
    toast.error(error);
  }

  /* ---------- Filtro de búsqueda ---------- */
  const filteredRoles = useMemo(() => {
    const raw = (searchTerm || "").trim();
    if (!raw) return roles;

    const removeAccents = (str) =>
      str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");

    const lowerSearch = removeAccents(raw.toLowerCase());

    const estados = [
      "activo",
      "inactivo",
      "vigente",
      "vencido",
      "suspendido",
      "pendiente",
    ];

    return roles.filter((rol) => {
      // Búsqueda exacta por estado
      if (
        rol.estado &&
        estados.includes(lowerSearch) &&
        removeAccents(rol.estado.toLowerCase()) === lowerSearch
      ) {
        return true;
      }

      const campos = [
        rol.nombre,
        rol.descripcion,
        rol.estado,
        rol.fecha_creacion,
        rol.id ? String(rol.id) : "",
      ];

      return campos.some(
        (campo) =>
          campo &&
          removeAccents(String(campo).toLowerCase()).includes(lowerSearch),
      );
    });
  }, [searchTerm, roles]);

  /* ---------- Handlers CRUD ---------- */

  const manejarCrearRol = async (nuevoRol) => {
    try {
      await crearRol(nuevoRol);
      toast.success("Rol creado exitosamente");
      return true; // el modal se cierra si onSave devuelve true
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al crear el rol");
      return false;
    }
  };

  const manejarActualizarRol = async (rolActualizado) => {
    try {
      if (!rolActualizado?.id && !rolSeleccionado?.id) {
        throw new Error("ID de rol no válido");
      }
      const id = rolActualizado.id ?? rolSeleccionado.id;
      await actualizarRol(id, rolActualizado);
      toast.success("Rol actualizado exitosamente");
      return true;
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al actualizar el rol");
      return false;
    }
  };

  const manejarEliminarRol = async (rolAEliminar) => {
    try {
      const id = rolAEliminar?.id ?? rolSeleccionado?.id;
      if (!id) throw new Error("ID de rol no válido");
      await eliminarRol(id);
      toast.success("Rol eliminado exitosamente");
      return true;
    } catch (err) {
      console.error(err);
      toast.error(err.message || "Error al eliminar el rol");
      return false;
    }
  };

  const manejarCambioEstado = async (rolActual) => {
    try {
      const estadoActual = Number(rolActual.id_estado) || 1;
      const nuevoEstado = estadoActual === 1 ? 2 : 1;

      await actualizarEstado(rolActual, nuevoEstado);
      toast.success(
        `Estado actualizado a ${nuevoEstado === 1 ? "Activo" : "Inactivo"}`,
      );
    } catch (err) {
      console.error(err);
      toast.error("Error al actualizar el estado del rol");
    }
  };

  /* ---------- Modales ---------- */

  const abrirModal = (accion, rol = null) => {
    setAccionModal(accion);
    setRolSeleccionado(rol);
  };

  const cerrarModal = () => {
    setAccionModal(null);
    setRolSeleccionado(null);
  };

  return (
    <div className="main-ad-column">
      <div className="encabezado-acciones">
        <div className="titulo-con-icono">
          <Users size={40} className="icono-titulo" />
          <h1>Gestión de Roles</h1>
        </div>
        <div className="acciones-derecha">
          <button
            onClick={() => abrirModal("crear")}
            className="boton boton-primario"
            disabled={!permisosListos}
            title={
              permisosListos
                ? undefined
                : "Cargando catálogo de permisos, intenta en un momento"
            }
          >
            <Plus size={18} /> Nuevo Rol
          </button>
          <BuscadorUniversal
            value={filtro}
            onChange={handleSearchChange}
            placeholder="Buscar rol..."
            className="expandido"
          />
        </div>
      </div>

      <DataTable
        columns={columnasRoles}
        data={filteredRoles.map((rol) => ({
          ...rol,
          // para que la columna Estado pueda disparar el cambio
          onStatusChange: manejarCambioEstado,
        }))}
        onEdit={(rol) => abrirModal("editar", rol)}
        onView={(rol) => abrirModal("ver", rol)}
        onDelete={(rol) => abrirModal("eliminar", rol)}
        loading={loading}
      />

      {/* Crear */}
      {accionModal === "crear" && (
        <ModalCrearRol
          onClose={cerrarModal}
          onSave={manejarCrearRol}
          permisoHelpers={permisoHelpers}
        />
      )}

      {/* Ver */}
      {accionModal === "ver" && rolSeleccionado && (
        <ModalVerRol
          rol={rolSeleccionado}
          onClose={cerrarModal}
          permisoHelpers={permisoHelpers}
        />
      )}

      {/* Editar */}
      {accionModal === "editar" && rolSeleccionado && (
        <ModalEditarRol
          rol={rolSeleccionado}
          onClose={cerrarModal}
          onSave={manejarActualizarRol}
          permisoHelpers={permisoHelpers}
        />
      )}

      {/* Eliminar */}
      {accionModal === "eliminar" && rolSeleccionado && (
        <ModalEliminarRol
          rol={rolSeleccionado}
          onClose={cerrarModal}
          onDelete={manejarEliminarRol}
        />
      )}
    </div>
  );
}

export default Roles;
