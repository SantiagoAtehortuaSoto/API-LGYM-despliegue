// src/features/dashboard/hooks/Roles_API/role_API_AD.jsx
import { useCallback, useEffect, useState } from "react";
import {
  getRoles,
  getDetallesRol,
  crearRol as apiCrearRol,
  actualizarRol as apiActualizarRol,
  actualizarEstadoRol as apiActualizarEstadoRol,
  eliminarRol as apiEliminarRol,
  getPermisosCatalog,
} from "../Roles_API/roles.jsx";

const normalizeText = (value = "") =>
  value
    .toString()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();

const mapPrivilegioToActionKey = (label = "") => {
  const normalized = normalizeText(label);
  if (normalized.startsWith("ver")) return "ver";
  if (normalized.startsWith("crea")) return "crear";
  if (normalized.startsWith("edi")) return "editar";
  if (normalized.startsWith("elim") || normalized.startsWith("bor")) {
    return "eliminar";
  }
  return null;
};

const buildPermisoHelpers = (catalogo = []) => {
  const moduloNameToPermisoId = {};
  const permisoIdToModuloName = {};
  const privilegioNameToId = {};
  const privilegioIdToAccion = {};

  catalogo.forEach((item) => {
    const moduloName = item?.modulo ?? "";
    const normalizedModulo = normalizeText(moduloName);

    const acciones = Array.isArray(item?.acciones) ? item.acciones : [];
    const firstAccion = acciones[0];
    if (firstAccion && Number.isInteger(Number(firstAccion.id_permiso))) {
      const permisoId = Number(firstAccion.id_permiso);
      moduloNameToPermisoId[normalizedModulo] = permisoId;
      permisoIdToModuloName[permisoId] = moduloName;
    }

    acciones.forEach((accion) => {
      const actionKey = mapPrivilegioToActionKey(accion?.privilegio);
      const privId = Number(accion?.id_privilegio);
      if (!actionKey || !Number.isInteger(privId)) return;
      privilegioNameToId[actionKey] = privId;
      privilegioIdToAccion[privId] = actionKey;
    });
  });

  return {
    rawCatalog: catalogo,
    moduloNameToPermisoId,
    permisoIdToModuloName,
    privilegioNameToId,
    privilegioIdToAccion,
  };
};

const mapRolFromApi = (apiRol = {}) => {
  const id = apiRol.id_rol ?? apiRol.id_roles ?? apiRol.id ?? 0;
  const nombre = apiRol.nombre_rol ?? apiRol.nombre ?? "";
  const descripcion = apiRol.descripcion_rol ?? apiRol.descripcion ?? "";

  const id_estado_raw = Number(apiRol.id_estado ?? 1);
  const id_estado = id_estado_raw === 1 ? 1 : 2;
  const estado = id_estado === 1 ? "Activo" : "Inactivo";

  const detalles = Array.isArray(apiRol.detallesrols)
    ? apiRol.detallesrols
    : [];

  const permisosAsignados = detalles
    .map((detalle) => ({
      id_permiso: Number(detalle.id_permiso ?? detalle.permiso_id),
      id_privilegio: Number(detalle.id_privilegio ?? detalle.privilegio_id),
    }))
    .filter(
      (item) =>
        Number.isInteger(item.id_permiso) && Number.isInteger(item.id_privilegio)
    );

  return {
    id,
    nombre,
    descripcion,
    id_estado,
    estado,
    permisosAsignados,
    fecha_creacion: apiRol.fecha_creacion ?? apiRol.created_at ?? "",
  };
};

const normalizePermisosArray = (permisos) => {
  if (!Array.isArray(permisos)) return [];
  return permisos
    .map((item) => {
      const id_permiso = Number(item.id_permiso);
      if (!Number.isInteger(id_permiso)) return null;
      let privilegios = [];
      if (Array.isArray(item.privilegios)) privilegios = item.privilegios;
      else if (item.id_privilegio != null) privilegios = [item.id_privilegio];

      const uniquePrivs = [
        ...new Set(
          privilegios
            .map((p) => Number(p))
            .filter((p) => Number.isInteger(p) && p > 0)
        ),
      ];

      if (uniquePrivs.length === 0) return null;
      return { id_permiso, privilegios: uniquePrivs };
    })
    .filter(Boolean);
};

const mapRolToApi = (uiRol = {}) => {
  const nombre_rol = (uiRol.nombre_rol ?? uiRol.nombre ?? "").trim();

  let id_estado = uiRol.id_estado;
  if (id_estado === undefined || id_estado === null) {
    if (typeof uiRol.estado === "string") {
      const est = uiRol.estado.toLowerCase();
      id_estado = est.includes("inac") ? 2 : 1;
    } else {
      id_estado = 1;
    }
  }
  id_estado = Number(id_estado) === 1 ? 1 : 2;

  const permisos = normalizePermisosArray(uiRol.permisos);

  return {
    nombre_rol,
    id_estado,
    permisos,
  };
};

/* ======================================================
   Hook: Gestión de Roles
====================================================== */
export function useRoles() {
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [permisosCatalogo, setPermisosCatalogo] = useState([]);
  const [permisoHelpers, setPermisoHelpers] = useState(null);

  const token = localStorage.getItem("token");

  const cargarCatalogoPermisos = useCallback(async () => {
    try {
      const res = await getPermisosCatalog({ token });
      const catalogo = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res)
        ? res
        : [];
      setPermisosCatalogo(catalogo);
      setPermisoHelpers(buildPermisoHelpers(catalogo));
    } catch (err) {
      console.error(err);
      setError((prev) => prev || "Error al cargar el catálogo de permisos");
    }
  }, [token]);

  useEffect(() => {
    cargarCatalogoPermisos();
  }, [cargarCatalogoPermisos]);

  const cargarRoles = useCallback(async () => {
    try {
      setLoading(true);
      setError("");

      const [resRoles, resDetalles] = await Promise.all([
        getRoles({ token }),
        getDetallesRol({ token }),
      ]);

      const listaRoles = Array.isArray(resRoles?.data)
        ? resRoles.data
        : Array.isArray(resRoles)
        ? resRoles
        : [];

      const listaDetalles = Array.isArray(resDetalles?.data)
        ? resDetalles.data
        : Array.isArray(resDetalles)
        ? resDetalles
        : [];

      const detallesPorRol = listaDetalles.reduce((acc, det) => {
        const idRol = det.id_rol ?? det.rol_id ?? det.idRol ?? det.id_roles;
        if (!idRol) return acc;
        if (!acc[idRol]) acc[idRol] = [];
        acc[idRol].push(det);
        return acc;
      }, {});

      const normalizados = listaRoles.map((rol) => {
        const idRol = rol.id_rol ?? rol.id ?? rol.id_roles;
        const detalles = detallesPorRol[idRol] || [];
        return mapRolFromApi({ ...rol, detallesrols: detalles });
      });

      setRoles(normalizados);
    } catch (err) {
      console.error(err);
      setError(err.message || "Error al cargar roles");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    cargarRoles();
  }, [cargarRoles]);

  const crearRol = useCallback(
    async (nuevoRolUI) => {
      const body = mapRolToApi(nuevoRolUI);
      const creado = await apiCrearRol(body, { token });
      await cargarRoles();
      return mapRolFromApi({ ...creado, detallesrols: [] });
    },
    [token, cargarRoles]
  );

  const actualizarRol = useCallback(
    async (id, rolActualizadoUI) => {
      const body = mapRolToApi(rolActualizadoUI);
      const actualizado = await apiActualizarRol(id, body, { token });
      await cargarRoles();
      return actualizado;
    },
    [token, cargarRoles]
  );

  const actualizarEstado = useCallback(
    async (rolActual, nuevoEstado) => {
      const id = rolActual.id;
      const actualizado = await apiActualizarEstadoRol(id, nuevoEstado, {
        token,
      });
      await cargarRoles();
      return actualizado;
    },
    [token, cargarRoles]
  );

  const eliminarRol = useCallback(
    async (id) => {
      await apiEliminarRol(id, { token });
      setRoles((prev) => prev.filter((r) => r.id !== id));
      return true;
    },
    [token]
  );

  return {
    roles,
    loading,
    error,
    permisosCatalogo,
    permisoHelpers,
    permisosListos: Boolean(permisoHelpers),
    recargar: cargarRoles,
    crearRol,
    actualizarRol,
    actualizarEstado,
    eliminarRol,
  };
}
