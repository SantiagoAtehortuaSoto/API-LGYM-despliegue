// src/shared/services/roles.api.js

const URL_ROLES = "https://totalitarian-punchily-lon.ngrok-free.dev/rol";
const URL_DETALLES_ROL =
  "https://totalitarian-punchily-lon.ngrok-free.dev/detallesrol";
const URL_PERMISOS =
  "https://totalitarian-punchily-lon.ngrok-free.dev/permisos";

/* ======================================================
   Helpers compartidos
====================================================== */
const DEBUG_HTTP = true;

function sanitizeBearer(token) {
  if (!token) return undefined;
  return token.replace(/^Bearer\s+/i, "");
}

function redactHeaders(h = {}) {
  const out = { ...h };
  if (out.Authorization) out.Authorization = "Bearer **redacted**";
  if (out.authorization) out.authorization = "Bearer **redacted**";
  return out;
}

async function logAndFetch(label, url, init = {}) {
  const method = (init.method || "GET").toUpperCase();
  const started = Date.now();
  const safeHeaders = redactHeaders(init.headers || {});
  const bodyStr =
    typeof init.body === "string"
      ? init.body
      : init.body
      ? JSON.stringify(init.body)
      : undefined;

  if (DEBUG_HTTP) {
    console.groupCollapsed(`%c${label} -> ${method} ${url}`, "color:#6b7280");
    console.log("[request] headers:", safeHeaders);
    console.log("[request] body:", bodyStr ?? "<none>");
  }

  const res = await fetch(url, init);
  const text = await res.text().catch(() => "");
  const ms = Date.now() - started;

  if (DEBUG_HTTP) {
    console.log("[response] status:", `${res.status} ${res.statusText}`, `(${ms}ms)`);
    console.log(
      "[response] content-type:",
      res.headers.get("content-type") || "<desconocido>"
    );
    console.log(
      "[response] body:",
      text.length > 2000 ? `${text.slice(0, 2000)}...[truncated]` : text
    );
    console.groupEnd();
  }

  if (!res.ok) {
    throw new Error(
      `${method} ${url} -> ${res.status} ${res.statusText} | ${text.slice(0, 300)}`
    );
  }

  if (!text) return null;

  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) return JSON.parse(text);
  return text;
}

function normalizePermisosPayload(permisosInput) {
  if (!Array.isArray(permisosInput)) return [];

  return permisosInput
    .map((item) => {
      const id_permiso = Number(item.id_permiso ?? item.permiso_id);
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

      return { id_permiso, privilegios: uniquePrivs };
    })
    .filter(Boolean);
}

function buildHeaders({ token, extraHeaders = {}, acceptJson = true } = {}) {
  return {
    ...(acceptJson ? { Accept: "application/json" } : {}),
    "ngrok-skip-browser-warning": "true",
    ...(token ? { Authorization: `Bearer ${sanitizeBearer(token)}` } : {}),
    ...extraHeaders,
  };
}

/* ======================================================
   GET: Listado de roles
====================================================== */
export async function getRoles({ token, query = {}, extraHeaders = {} } = {}) {
  const u = new URL(URL_ROLES);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);

  try {
    return await logAndFetch("[Roles][GET listado]", u.toString(), {
      method: "GET",
      headers: buildHeaders({ token, extraHeaders }),
      signal: ac.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/* ======================================================
   GET: Detalles de rol
====================================================== */
export async function getDetallesRol(
  { token, query = {}, extraHeaders = {} } = {}
) {
  const u = new URL(URL_DETALLES_ROL);
  Object.entries(query).forEach(([k, v]) => {
    if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
  });

  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), 10_000);

  try {
    return await logAndFetch("[Roles][GET detallesrol]", u.toString(), {
      method: "GET",
      headers: buildHeaders({ token, extraHeaders }),
      signal: ac.signal,
    });
  } catch (err) {
    const msg = String(err?.message || err);
    if (msg.includes("404")) {
      console.warn(
        "[Roles] GET /detallesrol devolvió 404; devolviendo [] como fallback"
      );
      return [];
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/* ======================================================
   GET: Catálogo de permisos con privilegios
====================================================== */
export async function getPermisosCatalog(
  { token, extraHeaders = {} } = {}
) {
  const u = new URL(URL_PERMISOS);
  u.searchParams.set("groupByModulo", "true");

  return logAndFetch("[Roles][GET permisos]", u.toString(), {
    method: "GET",
    headers: buildHeaders({ token, extraHeaders }),
  });
}

/* ======================================================
   POST: Crear rol
====================================================== */
export async function crearRol(bodyRaw = {}, { token } = {}) {
  const nombre_rol = (bodyRaw.nombre_rol ?? bodyRaw.nombre ?? "").trim();

  const id_estado_raw =
    bodyRaw.id_estado ?? (bodyRaw.estado === "Inactivo" ? 2 : 1);
  const id_estado = Number(id_estado_raw) === 2 ? 2 : 1;

  const permisos = normalizePermisosPayload(bodyRaw.permisos);

  const payload = {
    nombre_rol,
    id_estado,
    permisos,
  };

  return logAndFetch("[Roles][POST crear]", URL_ROLES, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders({ token }),
    },
    body: JSON.stringify(payload),
  });
}

/* ======================================================
   PUT: Actualizar rol
====================================================== */
export async function actualizarRol(id, bodyRaw = {}, { token } = {}) {
  const url = `${URL_ROLES}/${encodeURIComponent(id)}`;

  const nombre_rol = (bodyRaw.nombre_rol ?? bodyRaw.nombre ?? "").trim();

  const id_estado_raw =
    bodyRaw.id_estado ?? (bodyRaw.estado === "Inactivo" ? 2 : 1);
  const id_estado = Number(id_estado_raw) === 2 ? 2 : 1;

  const permisos = normalizePermisosPayload(bodyRaw.permisos);

  const payload = {
    nombre_rol,
    id_estado,
    permisos,
  };

  return logAndFetch("[Roles][PUT actualizar]", url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders({ token }),
    },
    body: JSON.stringify(payload),
  });
}

/* ======================================================
   PUT: Cambiar estado (mantiene permisos actuales)
====================================================== */
export async function actualizarEstadoRol(id, nuevoEstado, { token } = {}) {
  const idNum = Number(id);
  const urlRol = `${URL_ROLES}/${encodeURIComponent(idNum)}`;
  const authHeader = token
    ? { Authorization: `Bearer ${sanitizeBearer(token)}` }
    : {};

  const current = await logAndFetch("[Roles][GET por id]", urlRol, {
    method: "GET",
    headers: {
      "ngrok-skip-browser-warning": "true",
      Accept: "application/json",
      ...authHeader,
    },
  });

  const cur =
    current && typeof current === "object" ? current.data ?? current : {};

  const nombre_rol = (cur.nombre_rol ?? cur.nombre ?? "").trim();

  const detallesRaw = await getDetallesRol({ token });

  const listaDetalles = Array.isArray(detallesRaw?.data)
    ? detallesRaw.data
    : Array.isArray(detallesRaw)
    ? detallesRaw
    : [];

  const detallesDelRol = listaDetalles.filter((det) => {
    const idRolDet = det.id_rol ?? det.rol_id ?? det.idRol ?? det.id_roles;
    return Number(idRolDet) === idNum;
  });

  const mapaPermisos = new Map();

  for (const det of detallesDelRol) {
    const id_permiso = det.id_permiso ?? det.permiso_id;
    const id_privilegio = det.id_privilegio ?? det.privilegio_id;

    if (!Number.isInteger(Number(id_permiso))) continue;

    if (!mapaPermisos.has(id_permiso)) {
      mapaPermisos.set(id_permiso, new Set());
    }

    if (Number.isInteger(Number(id_privilegio))) {
      mapaPermisos.get(id_permiso).add(Number(id_privilegio));
    }
  }

  const permisos = Array.from(mapaPermisos.entries()).map(
    ([id_permiso, setPrivs]) => ({
      id_permiso: Number(id_permiso),
      privilegios: Array.from(setPrivs),
    })
  );

  const payload = {
    nombre_rol,
    id_estado: Number(nuevoEstado) === 1 ? 1 : 2,
    permisos,
  };

  return logAndFetch("[Roles][PUT estado completo]", urlRol, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildHeaders({ token }),
    },
    body: JSON.stringify(payload),
  });
}

/* ======================================================
   DELETE: Eliminar rol
====================================================== */
export async function eliminarRol(id, { token } = {}) {
  const url = `${URL_ROLES}/${encodeURIComponent(id)}`;

  await logAndFetch("[Roles][DELETE eliminar]", url, {
    method: "DELETE",
    headers: buildHeaders({ token }),
  });

  return true;
}
