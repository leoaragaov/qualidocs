
-- 1) Access-code column
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS codigo_acesso TEXT UNIQUE;

-- 2) Random-code generator: CTS-XXX (uppercase letters/digits, no confusing chars)
CREATE OR REPLACE FUNCTION public.tms_generate_access_code()
RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SET search_path = public
AS $$
DECLARE
  alphabet TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  code TEXT;
  i INT;
  exists_already BOOLEAN;
BEGIN
  LOOP
    code := 'CTS-';
    FOR i IN 1..3 LOOP
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    END LOOP;
    SELECT EXISTS(SELECT 1 FROM public.projects WHERE codigo_acesso = code) INTO exists_already;
    EXIT WHEN NOT exists_already;
  END LOOP;
  RETURN code;
END;
$$;

-- 3) Auto-fill on insert
CREATE OR REPLACE FUNCTION public.tms_set_access_code()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.codigo_acesso IS NULL OR NEW.codigo_acesso = '' THEN
    NEW.codigo_acesso := public.tms_generate_access_code();
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_projects_access_code ON public.projects;
CREATE TRIGGER trg_projects_access_code
  BEFORE INSERT ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tms_set_access_code();

-- 4) Backfill existing rows
UPDATE public.projects
SET codigo_acesso = public.tms_generate_access_code()
WHERE codigo_acesso IS NULL;

-- 5) Join-by-code RPC (any authenticated user; SECURITY DEFINER bypasses project RLS
--    so a non-member can look up the project by code and enroll themselves)
CREATE OR REPLACE FUNCTION public.tms_join_by_code(_code TEXT)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_pid UUID;
  v_norm TEXT;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Autenticação necessária';
  END IF;

  v_norm := upper(trim(_code));
  -- Accept with or without "CTS-" prefix
  IF v_norm !~ '^CTS-' AND length(v_norm) = 3 THEN
    v_norm := 'CTS-' || v_norm;
  END IF;

  SELECT id INTO v_pid FROM public.projects WHERE codigo_acesso = v_norm LIMIT 1;
  IF v_pid IS NULL THEN
    RAISE EXCEPTION 'Código inválido';
  END IF;

  INSERT INTO public.project_members (project_id, user_id, role, status, accepted_at, invited_by)
  VALUES (v_pid, v_uid, 'collaborator', 'accepted', now(), v_uid)
  ON CONFLICT (project_id, user_id) DO UPDATE
    SET status = 'accepted',
        accepted_at = COALESCE(public.project_members.accepted_at, now());

  RETURN v_pid;
END;
$$;

GRANT EXECUTE ON FUNCTION public.tms_join_by_code(TEXT) TO authenticated;
