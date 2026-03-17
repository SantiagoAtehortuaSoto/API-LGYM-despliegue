// src/pages/lo-que-sea/modalRoles.jsx
import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  memo,
} from "react";
import PropTypes from "prop-types";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import Button from "../../../../../shared/components/Button/Button";
import Input from "../../../../../shared/components/Input/Input";
import Select from "../../../../../shared/components/Select/Select";
import { useCollapsibleModules } from "./useCollapsibleModules";
import toast from "react-hot-toast";

// 🔹 Acciones permitidas a nivel de UI
export const PERMISSION_ACTIONS = ["ver", "crear", "editar", "eliminar"];

/* ======================================================
   Definición de módulos y helpers de permisos
====================================================== */

const MODULOS_DEF = [
  {
    categoria: "Usuarios",
    modulos: ["Usuarios", "Roles", "Clientes"],
  },
  {
    categoria: "Membresías",
    modulos: ["Membresías", "Planes"],
  },
  {
    categoria: "Clases",
    modulos: ["Clases", "Horarios"],
  },
  {
    categoria: "Pagos",
    modulos: ["Facturación", "Reportes"],
  },
];

const normalizeText = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const MODULO_META = (() => {
  const byKey = {};
  const nameToKey = {};

  MODULOS_DEF.forEach(({ categoria, modulos }) => {
    modulos.forEach((modulo) => {
      const key = `${categoria}_${modulo}`;
      const normalized = normalizeText(modulo);
      byKey[key] = { categoria, modulo, normalized };
      nameToKey[normalized] = key;
    });
  });

  return { byKey, nameToKey };
})();

const createActionState = () =>
  PERMISSION_ACTIONS.reduce((acc, action) => {
    acc[action] = false;
    return acc;
  }, {});

function createEmptyPermisosState() {
  const permisos = {};
  MODULOS_DEF.forEach(({ categoria, modulos }) => {
    modulos.forEach((modulo) => {
      const key = `${categoria}_${modulo}`;
      permisos[key] = createActionState();
    });
  });
  return permisos;
}

function buildPermisosModulosFromAsignados(asignaciones = [], helpers) {
  const base = createEmptyPermisosState();
  if (!helpers) return base;

  asignaciones.forEach((item) => {
    const id_permiso = Number(item.id_permiso);
    const id_privilegio = Number(item.id_privilegio);

    if (!Number.isInteger(id_permiso) || !Number.isInteger(id_privilegio)) {
      return;
    }

    const moduloName = helpers?.permisoIdToModuloName?.[id_permiso];
    const accion = helpers?.privilegioIdToAccion?.[id_privilegio];
    if (!moduloName || !accion) return;

    const moduloKey = MODULO_META.nameToKey[normalizeText(moduloName)];
    if (!moduloKey) return;

    if (!base[moduloKey]) {
      base[moduloKey] = createActionState();
    }

    if (Object.prototype.hasOwnProperty.call(base[moduloKey], accion)) {
      base[moduloKey][accion] = true;
    }
  });

  return base;
}

function mapPermisosModulosToPayload(permisosModulos, helpers) {
  if (!helpers) return [];

  const resultado = [];

  Object.entries(permisosModulos || {}).forEach(([key, acciones]) => {
    const meta = MODULO_META.byKey[key];
    if (!meta) return;

    const id_permiso = helpers?.moduloNameToPermisoId?.[meta.normalized];
    if (!Number.isInteger(id_permiso)) return;

    const privilegios = Object.entries(acciones)
      .filter(([, checked]) => checked)
      .map(([accion]) => helpers?.privilegioNameToId?.[accion])
      .filter((id) => Number.isInteger(id));

    const unique = [...new Set(privilegios)];
    if (unique.length > 0) {
      resultado.push({ id_permiso, privilegios: unique });
    }
  });

  return resultado;
}

const clonePermisos = (permisos) => JSON.parse(JSON.stringify(permisos || {}));
const arePermisosEqual = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// 🔹 Componente de item de permiso simple
export const PermissionItem = memo(
  ({ label, checked, onChange, disabled = false }) => {
    const id = `permiso-${label}`;
    return (
      <div className="item-permiso">
        <input
          type="checkbox"
          id={id}
          checked={checked}
          onChange={onChange}
          disabled={disabled}
          className="checkbox-permiso"
        />
        <label htmlFor={id} className="etiqueta-permiso">
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </label>
      </div>
    );
  }
);

// 🔹 Contenido de cada módulo
export const ModuleContent = memo(
  ({ categoria, modulos, permisos, onPermisoChange, disabled = false }) => (
    <div className="modulos-permisos">
      {modulos.map((modulo) => {
        const key = `${categoria}_${modulo}`;
        const moduloPermisos = permisos[key] || {};
        return (
          <div key={key} className="modulo-permisos">
            <h4 className="titulo-modulo">{modulo}</h4>
            <div className="lista-permisos">
              {PERMISSION_ACTIONS.map((accion) => {
                const permisoId = `permiso-${key}-${accion}`;
                const estaHabilitado = !disabled && onPermisoChange;
                return (
                  <div key={permisoId} className="item-permiso">
                    <input
                      type="checkbox"
                      id={permisoId}
                      checked={!!moduloPermisos[accion]}
                      onChange={() =>
                        onPermisoChange?.(categoria, modulo, accion)
                      }
                      disabled={!estaHabilitado}
                      className="checkbox-permiso"
                    />
                    <label
                      htmlFor={permisoId}
                      className="etiqueta-permiso"
                      style={{
                        cursor: estaHabilitado ? "pointer" : "default",
                        opacity: disabled ? 0.7 : 1,
                      }}
                    >
                      {accion.charAt(0).toUpperCase() + accion.slice(1)}
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  )
);

ModuleContent.displayName = "ModuleContent";

/* ======================================================
   Modal base
====================================================== */

const BaseRoleModal = ({
  title,
  initialData = {},
  onClose,
  onSave,
  showPermissions = true,
  disabled = false,
  permisoHelpers,
}) => {
  const modalRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (modalRef.current && !modalRef.current.contains(event.target)) {
        onClose();
      }
    };
    if (!disabled) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose, disabled]);

  const permisosIniciales = useMemo(() => {
    if (initialData.permisosModulos) {
      return clonePermisos(initialData.permisosModulos);
    }
    if (initialData.permisosAsignados) {
      return buildPermisosModulosFromAsignados(
        initialData.permisosAsignados,
        permisoHelpers
      );
    }
    return createEmptyPermisosState();
  }, [initialData, permisoHelpers]);

  const { collapsedModules, toggleModule, toggleAll, isAllCollapsed } =
    useCollapsibleModules(MODULOS_DEF);

  const [formData, setFormData] = useState(() => ({
    id: initialData.id || null,
    nombre_rol: initialData.nombre_rol || initialData.nombre || "",
    descripcion: initialData.descripcion || "",
    tipoPanel: initialData.tipoPanel || "empleado",
    estado: initialData.estado || "Activo",
    fecha_creacion:
      initialData.fecha_creacion || new Date().toISOString().split("T")[0],
    permisosModulos: permisosIniciales,
  }));

  useEffect(() => {
    setFormData((prev) => {
      if (arePermisosEqual(prev.permisosModulos, permisosIniciales)) {
        return prev;
      }
      return { ...prev, permisosModulos: permisosIniciales };
    });
  }, [permisosIniciales]);

  const handleInputChange = useCallback((e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const handlePermisoChange = useCallback((categoria, modulo, accion) => {
    setFormData((prev) => {
      const key = `${categoria}_${modulo}`;
      const prevModulo = prev.permisosModulos[key] || createActionState();
      return {
        ...prev,
        permisosModulos: {
          ...prev.permisosModulos,
          [key]: {
            ...prevModulo,
            [accion]: !prevModulo[accion],
          },
        },
      };
    });
  }, []);

  const permisosListos = Boolean(permisoHelpers);

  const handleSubmit = useCallback(
    async (e) => {
      e.preventDefault();

      if (!formData.nombre_rol.trim()) {
        toast.error("El nombre del rol es obligatorio");
        return;
      }

      if (!permisosListos) {
        toast.error("El catálogo de permisos aún no está disponible");
        return;
      }

      const permisosPayload = mapPermisosModulosToPayload(
        formData.permisosModulos,
        permisoHelpers
      );

      const payload = {
        id: formData.id,
        nombre_rol: formData.nombre_rol.trim(),
        nombre: formData.nombre_rol.trim(),
        descripcion: formData.descripcion || "",
        tipoPanel: formData.tipoPanel,
        estado: formData.estado,
        permisos: permisosPayload,
        permisosModulos: formData.permisosModulos,
        permisosAsignados: permisosPayload.flatMap((combo) =>
          combo.privilegios.map((id_privilegio) => ({
            id_permiso: combo.id_permiso,
            id_privilegio,
          }))
        ),
      };

      try {
        const ok = await onSave(payload);
        if (ok) onClose();
      } catch (err) {
        console.error(err);
        toast.error(err.message || "Error al guardar el rol");
      }
    },
    [formData, onSave, onClose, permisoHelpers, permisosListos]
  );

  return (
    <div className="modal-overlay capa-modal">
      <div className="contenedor-modal modal-mediano" ref={modalRef}>
        <div className="encabezado-modal">
          <h2>{title}</h2>
          <button className="boton-cerrar" onClick={onClose} aria-label="Cerrar">
            <X size={18} />
          </button>
        </div>
        <div className="cuerpo-modal">
          <form onSubmit={handleSubmit} className="formulario-modal">
            <div className="grupo-formulario">
              <label>Nombre del Rol</label>
              <Input
                type="text"
                name="nombre_rol"
                value={formData.nombre_rol}
                onChange={handleInputChange}
                disabled={disabled}
                required
                placeholder="Ej: Administrador"
              />
            </div>

            <div className="grupo-formulario">
              <label>Tipo de Panel</label>
              <Select
                name="tipoPanel"
                value={formData.tipoPanel}
                onChange={handleInputChange}
                disabled={disabled}
                required
                options={[
                  { value: "admin", label: "Panel de Administrador" },
                  { value: "empleado", label: "Panel de Empleado" },
                  { value: "beneficiario", label: "Panel de Beneficiario" },
                ]}
              />
            </div>

            <div className="grupo-formulario">
              <label>Estado</label>
              <Select
                name="estado"
                value={formData.estado}
                onChange={handleInputChange}
                disabled={disabled}
                options={[
                  { value: "Activo", label: "Activo" },
                  { value: "Inactivo", label: "Inactivo" },
                ]}
              />
            </div>

            {showPermissions && (
              <div className="seccion-permisos">
                <div className="encabezado-permisos">
                  <h3>Permisos</h3>
                  <button
                    type="button"
                    className="btn-control-permisos"
                    onClick={toggleAll}
                  >
                    {isAllCollapsed() ? "Expandir Todos" : "Colapsar Todos"}
                  </button>
                </div>
                {!permisosListos && (
                  <p className="mensaje-info">
                    Cargando catálogo de permisos...
                  </p>
                )}
                {MODULOS_DEF.map(({ categoria, modulos }) => (
                  <div key={categoria} className="modulo">
                    <button
                      type="button"
                      className="modulo-encabezado"
                      onClick={() => toggleModule(categoria)}
                    >
                      {!collapsedModules[categoria] ? (
                        <ChevronDown size={16} />
                      ) : (
                        <ChevronRight size={16} />
                      )}
                      <span>{categoria}</span>
                    </button>
                    {!collapsedModules[categoria] && (
                      <div className="contenido-modulo">
                        <ModuleContent
                          categoria={categoria}
                          modulos={modulos}
                          permisos={formData.permisosModulos}
                          onPermisoChange={
                            !disabled && permisosListos
                              ? handlePermisoChange
                              : undefined
                          }
                          disabled={disabled || !permisosListos}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div className="pie-modal">
              <div className="grupo-botones">
                <Button
                  type="button"
                  variant="secondary"
                  className="boton boton-secundario"
                  onClick={onClose}
                >
                  Cancelar
                </Button>
                {!disabled && (
                  <Button
                    type="submit"
                    variant="primary"
                    className="boton boton-primario"
                    disabled={!permisosListos}
                  >
                    Guardar Cambios
                  </Button>
                )}
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

/* ======================================================
   Modales específicos
====================================================== */

export const ModalCrearRol = memo(({ onClose, onSave, permisoHelpers }) => (
  <BaseRoleModal
    title="Crear Nuevo Rol"
    onClose={onClose}
    onSave={onSave}
    permisoHelpers={permisoHelpers}
  />
));

export const ModalEditarRol = memo(({ rol, onClose, onSave, permisoHelpers }) => {
  const initialData = useMemo(
    () => ({
      id: rol?.id || null,
      nombre_rol: rol?.nombre_rol || rol?.nombre || "",
      descripcion: rol?.descripcion || "",
      tipoPanel: rol?.tipoPanel || "empleado",
      estado: rol?.estado || "Activo",
      fecha_creacion:
        rol?.fecha_creacion || new Date().toISOString().split("T")[0],
      permisosAsignados: rol?.permisosAsignados || [],
    }),
    [rol]
  );
  return (
    <BaseRoleModal
      title={`Editar Rol: ${rol?.nombre || "Nuevo Rol"}`}
      initialData={initialData}
      onClose={onClose}
      onSave={onSave}
      permisoHelpers={permisoHelpers}
    />
  );
});

export const ModalVerRol = memo(({ rol, onClose, permisoHelpers }) =>
  rol ? (
    <BaseRoleModal
      title={`Detalles del Rol: ${rol.nombre}`}
      initialData={{
        ...rol,
        permisosAsignados: rol.permisosAsignados || [],
      }}
      onClose={onClose}
      onSave={async () => true}
      disabled
      permisoHelpers={permisoHelpers}
    />
  ) : null
);

export const ModalEliminarRol = memo(({ rol, onClose, onDelete }) => {
  const modalRef = useRef(null);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (modalRef.current && !modalRef.current.contains(e.target)) onClose();
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);
  if (!rol) return null;
  const handleDelete = useCallback(() => {
    onDelete(rol);
  }, [rol, onDelete]);
  return (
    <div className="modal-overlay capa-modal">
      <div className="contenedor-modal modal-eliminar" ref={modalRef}>
        <div className="encabezado-modal">
          <h2>Eliminar Rol</h2>
          <button type="button" className="boton-cerrar" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
        <div className="cuerpo-modal">
          <h3>¿Eliminar este rol?</h3>
          <p>
            <strong>{rol.nombre}</strong>
          </p>
          <p>Esta acción no se puede deshacer.</p>
        </div>
        <div className="pie-modal">
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="button" variant="danger" onClick={handleDelete}>
            Eliminar
          </Button>
        </div>
      </div>
    </div>
  );
});

/* ======================================================
   PropTypes
====================================================== */

BaseRoleModal.propTypes = {
  title: PropTypes.string.isRequired,
  initialData: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  showPermissions: PropTypes.bool,
  disabled: PropTypes.bool,
  permisoHelpers: PropTypes.object,
};
ModalCrearRol.propTypes = {
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  permisoHelpers: PropTypes.object,
};
ModalEditarRol.propTypes = {
  rol: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onSave: PropTypes.func.isRequired,
  permisoHelpers: PropTypes.object,
};
ModalVerRol.propTypes = {
  rol: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  permisoHelpers: PropTypes.object,
};
ModalEliminarRol.propTypes = {
  rol: PropTypes.object,
  onClose: PropTypes.func.isRequired,
  onDelete: PropTypes.func.isRequired,
};
