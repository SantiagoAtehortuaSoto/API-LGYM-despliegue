BEGIN;

-- Core state catalog. IDs are explicit to align with app defaults.
INSERT INTO public.estados (id_estado, estado, descripcion)
VALUES
  (1, 'ACTIVO', 'Registro activo'),
  (2, 'PENDIENTE_VERIFICACION', 'Pendiente de verificacion de cuenta'),
  (3, 'PENDIENTE', 'Pendiente de procesamiento'),
  (4, 'COMPLETADO', 'Proceso finalizado correctamente'),
  (5, 'CANCELADO', 'Proceso cancelado'),
  (6, 'RECHAZADO', 'Proceso rechazado'),
  (7, 'INACTIVO', 'Registro inactivo'),
  (8, 'VENCIDO', 'Registro vencido')
ON CONFLICT (id_estado)
DO UPDATE
SET
  estado = EXCLUDED.estado,
  descripcion = EXCLUDED.descripcion;

COMMIT;
