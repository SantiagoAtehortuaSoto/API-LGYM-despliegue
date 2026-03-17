BEGIN;

-- Protected roles defined in .env:
-- ADMIN_ROLE_ID=32
-- DEFAULT_ROLE_ID=33
INSERT INTO public.rol (id_rol, nombre, id_estado)
VALUES
  (32, 'Administrador', 1),
  (33, 'Cliente', 1)
ON CONFLICT (id_rol)
DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  id_estado = EXCLUDED.id_estado;

COMMIT;
