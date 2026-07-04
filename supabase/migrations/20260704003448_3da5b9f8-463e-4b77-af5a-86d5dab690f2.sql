
CREATE OR REPLACE FUNCTION public.tms_create_project(_projeto text)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_row public.projects;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;
  IF _projeto IS NULL OR length(trim(_projeto)) = 0 THEN
    RAISE EXCEPTION 'Nome do projeto é obrigatório';
  END IF;

  INSERT INTO public.projects (owner_id, projeto)
  VALUES (v_uid, _projeto)
  RETURNING * INTO v_row;

  RETURN v_row;
END;
$$;

REVOKE ALL ON FUNCTION public.tms_create_project(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tms_create_project(text) TO authenticated;
