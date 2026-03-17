BEGIN;

-- Permission modules referenced in route authorization.
INSERT INTO public.permisos (id_permiso, nombre, id_estado)
VALUES
  (1, 'Roles', 1),
  (2, 'Usuarios', 1),
  (3, 'Clientes', 1),
  (4, 'Servicios', 1),
  (5, 'Productos', 1),
  (6, 'Proveedores', 1),
  (7, 'Compras', 1),
  (8, 'Asistencia', 1),
  (9, 'Seguimiento deportivo', 1),
  (10, 'Citas', 1),
  (11, 'Ventas Membresias', 1),
  (12, 'Ventas', 1),
  (13, 'Membresias', 1)
ON CONFLICT (id_permiso)
DO UPDATE
SET
  nombre = EXCLUDED.nombre,
  id_estado = EXCLUDED.id_estado;

COMMIT;
