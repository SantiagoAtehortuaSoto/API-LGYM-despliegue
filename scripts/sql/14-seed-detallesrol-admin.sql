BEGIN;

-- Give role 32 (Administrador) all active permissions and active privileges.
INSERT INTO public.detallesrol (id_rol, id_permiso, id_privilegio)
SELECT
  32 AS id_rol,
  p.id_permiso,
  pr.id_privilegio
FROM public.permisos p
CROSS JOIN public.privilegios pr
WHERE p.id_estado = 1
  AND pr.id_estado = 1
  AND EXISTS (
    SELECT 1
    FROM public.rol r
    WHERE r.id_rol = 32
      AND r.id_estado = 1
  )
ON CONFLICT (id_rol, id_permiso, id_privilegio)
DO NOTHING;

COMMIT;
