
-- ============ ACCESS REQUESTS ============
CREATE TYPE public.access_request_status AS ENUM ('pending','approved','rejected','cancelled');

CREATE TABLE public.access_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  message TEXT,
  status public.access_request_status NOT NULL DEFAULT 'pending',
  requested_role public.project_role NOT NULL DEFAULT 'collaborator',
  decided_by UUID,
  decided_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX access_requests_pending_uniq
  ON public.access_requests(project_id, user_id)
  WHERE status = 'pending';
CREATE INDEX access_requests_project_idx ON public.access_requests(project_id, status);
CREATE INDEX access_requests_user_idx ON public.access_requests(user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.access_requests TO authenticated;
GRANT ALL ON public.access_requests TO service_role;

ALTER TABLE public.access_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ar_select_own_or_manager" ON public.access_requests
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR public.tms_can_manage(project_id));

CREATE POLICY "ar_insert_self" ON public.access_requests
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND status = 'pending');

CREATE POLICY "ar_update_self_cancel" ON public.access_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ar_update_manager" ON public.access_requests
  FOR UPDATE TO authenticated
  USING (public.tms_can_manage(project_id))
  WITH CHECK (public.tms_can_manage(project_id));

CREATE POLICY "ar_delete_manager" ON public.access_requests
  FOR DELETE TO authenticated
  USING (public.tms_can_manage(project_id) OR user_id = auth.uid());

CREATE TRIGGER trg_access_requests_updated_at
  BEFORE UPDATE ON public.access_requests
  FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();

-- ============ NOTIFICATIONS ============
CREATE TABLE public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  type TEXT NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id UUID,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX notifications_user_created_idx
  ON public.notifications (user_id, created_at DESC);
CREATE INDEX notifications_user_unread_idx
  ON public.notifications (user_id) WHERE read_at IS NULL;

GRANT SELECT, UPDATE, DELETE ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO service_role;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "notif_select_own" ON public.notifications
  FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "notif_update_own" ON public.notifications
  FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "notif_delete_own" ON public.notifications
  FOR DELETE TO authenticated USING (user_id = auth.uid());
-- Inserts happen only via SECURITY DEFINER helpers below.

-- ============ HELPERS ============
CREATE OR REPLACE FUNCTION public.tms_notify_managers(_pid uuid, _type text, _actor uuid, _data jsonb)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notifications (user_id, type, project_id, actor_id, data)
  SELECT pm.user_id, _type, _pid, _actor, COALESCE(_data, '{}'::jsonb)
  FROM public.project_members pm
  WHERE pm.project_id = _pid
    AND pm.status = 'accepted'
    AND pm.role IN ('owner','admin')
    AND (_actor IS NULL OR pm.user_id <> _actor);
END; $$;

-- ============ Replace tms_join_by_code: creates request instead of joining ============
CREATE OR REPLACE FUNCTION public.tms_join_by_code(_code text)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_pid uuid;
  v_norm text;
  v_role public.project_role;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  v_norm := upper(trim(_code));
  IF v_norm !~ '^CTS-' AND length(v_norm) = 3 THEN
    v_norm := 'CTS-' || v_norm;
  END IF;

  SELECT id INTO v_pid FROM public.projects WHERE codigo_acesso = v_norm LIMIT 1;
  IF v_pid IS NULL THEN RAISE EXCEPTION 'Código inválido'; END IF;

  -- Already a member? Just return the project id.
  v_role := public.tms_project_role(v_pid, v_uid);
  IF v_role IS NOT NULL THEN
    RETURN v_pid;
  END IF;

  -- Create a pending request (idempotent thanks to partial unique index).
  BEGIN
    INSERT INTO public.access_requests (project_id, user_id, status)
    VALUES (v_pid, v_uid, 'pending');
    PERFORM public.tms_notify_managers(
      v_pid, 'access_request', v_uid,
      jsonb_build_object('via', 'code', 'code', v_norm)
    );
  EXCEPTION WHEN unique_violation THEN
    -- request already pending; no-op
    NULL;
  END;

  RETURN v_pid;
END; $$;

-- ============ Request access directly (by project id) ============
CREATE OR REPLACE FUNCTION public.tms_request_access(_pid uuid, _message text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.projects WHERE id = _pid) THEN
    RAISE EXCEPTION 'Projeto inexistente';
  END IF;
  IF public.tms_project_role(_pid, v_uid) IS NOT NULL THEN
    RAISE EXCEPTION 'Você já é membro deste projeto';
  END IF;

  BEGIN
    INSERT INTO public.access_requests (project_id, user_id, status, message)
    VALUES (_pid, v_uid, 'pending', _message)
    RETURNING id INTO v_id;
    PERFORM public.tms_notify_managers(
      _pid, 'access_request', v_uid, jsonb_build_object('via','direct')
    );
  EXCEPTION WHEN unique_violation THEN
    SELECT id INTO v_id FROM public.access_requests
      WHERE project_id = _pid AND user_id = v_uid AND status = 'pending' LIMIT 1;
  END;

  RETURN v_id;
END; $$;

-- ============ Decide access request (approve / reject) ============
CREATE OR REPLACE FUNCTION public.tms_decide_access_request(_request_id uuid, _approve boolean)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
  r public.access_requests%ROWTYPE;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  SELECT * INTO r FROM public.access_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF NOT public.tms_can_manage(r.project_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação já foi decidida'; END IF;

  IF _approve THEN
    INSERT INTO public.project_members (project_id, user_id, role, status, accepted_at, invited_by)
    VALUES (r.project_id, r.user_id, r.requested_role, 'accepted', now(), v_uid)
    ON CONFLICT (project_id, user_id) DO UPDATE
      SET status = 'accepted',
          accepted_at = COALESCE(public.project_members.accepted_at, now()),
          role = EXCLUDED.role;

    UPDATE public.access_requests
      SET status = 'approved', decided_by = v_uid, decided_at = now()
      WHERE id = _request_id;

    INSERT INTO public.notifications (user_id, type, project_id, actor_id, data)
    VALUES (r.user_id, 'access_approved', r.project_id, v_uid, '{}'::jsonb);
  ELSE
    UPDATE public.access_requests
      SET status = 'rejected', decided_by = v_uid, decided_at = now()
      WHERE id = _request_id;

    INSERT INTO public.notifications (user_id, type, project_id, actor_id, data)
    VALUES (r.user_id, 'access_rejected', r.project_id, v_uid, '{}'::jsonb);
  END IF;
END; $$;

-- ============ Public preview for non-members ============
CREATE OR REPLACE FUNCTION public.tms_project_preview(_pid uuid)
RETURNS TABLE(
  id uuid,
  projeto text,
  objetivo text,
  owner_id uuid,
  member_count int,
  my_membership_status text,
  my_request_status text
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_uid uuid := auth.uid();
BEGIN
  RETURN QUERY
  SELECT p.id, p.projeto, p.objetivo, p.owner_id,
    (SELECT COUNT(*)::int FROM public.project_members m
       WHERE m.project_id = p.id AND m.status = 'accepted'),
    (SELECT pm.status FROM public.project_members pm
       WHERE pm.project_id = p.id AND pm.user_id = v_uid LIMIT 1),
    (SELECT ar.status::text FROM public.access_requests ar
       WHERE ar.project_id = p.id AND ar.user_id = v_uid
       ORDER BY ar.created_at DESC LIMIT 1)
  FROM public.projects p WHERE p.id = _pid;
END; $$;

-- ============ Invitation acceptance → notify managers ============
CREATE OR REPLACE FUNCTION public.tms_notify_invitation_accepted()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'accepted' AND (OLD.status IS DISTINCT FROM 'accepted') THEN
    PERFORM public.tms_notify_managers(
      NEW.project_id, 'invitation_accepted', NEW.accepted_by,
      jsonb_build_object('email', NEW.email)
    );
  END IF;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_notify_invitation_accepted ON public.project_invitations;
CREATE TRIGGER trg_notify_invitation_accepted
  AFTER UPDATE ON public.project_invitations
  FOR EACH ROW EXECUTE FUNCTION public.tms_notify_invitation_accepted();
