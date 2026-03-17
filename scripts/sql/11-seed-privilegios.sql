BEGIN;

-- CRUD privileges expected by middleware/authorization.js
INSERT INTO public.privilegios (id_privilegio, nombre, id_estado)
VALUES
  (1, 'ver', 1),
  (2, 'crear', 1),
  (3, 'editar', 1),
  (4, 'eliminar', 1)
ON CONFLICT (id_privilegio)
DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  id_estado = EXCLUDED.id_estado;

COMMIT;
