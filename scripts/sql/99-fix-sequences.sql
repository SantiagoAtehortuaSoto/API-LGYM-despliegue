DO $$
DECLARE
  seq_name text;
  max_id bigint;
BEGIN
  -- estados.id_estado
  SELECT pg_get_serial_sequence('public.estados', 'id_estado') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    SELECT COALESCE(MAX(id_estado), 0) INTO max_id FROM public.estados;
    IF max_id = 0 THEN
      PERFORM setval(seq_name, 1, false);
    ELSE
      PERFORM setval(seq_name, max_id, true);
    END IF;
  END IF;

  -- privilegios.id_privilegio
  SELECT pg_get_serial_sequence('public.privilegios', 'id_privilegio') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    SELECT COALESCE(MAX(id_privilegio), 0) INTO max_id FROM public.privilegios;
    IF max_id = 0 THEN
      PERFORM setval(seq_name, 1, false);
    ELSE
      PERFORM setval(seq_name, max_id, true);
    END IF;
  END IF;

  -- permisos.id_permiso
  SELECT pg_get_serial_sequence('public.permisos', 'id_permiso') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    SELECT COALESCE(MAX(id_permiso), 0) INTO max_id FROM public.permisos;
    IF max_id = 0 THEN
      PERFORM setval(seq_name, 1, false);
    ELSE
      PERFORM setval(seq_name, max_id, true);
    END IF;
  END IF;

  -- rol.id_rol
  SELECT pg_get_serial_sequence('public.rol', 'id_rol') INTO seq_name;
  IF seq_name IS NOT NULL THEN
    SELECT COALESCE(MAX(id_rol), 0) INTO max_id FROM public.rol;
    IF max_id = 0 THEN
      PERFORM setval(seq_name, 1, false);
    ELSE
      PERFORM setval(seq_name, max_id, true);
    END IF;
  END IF;
END $$;
