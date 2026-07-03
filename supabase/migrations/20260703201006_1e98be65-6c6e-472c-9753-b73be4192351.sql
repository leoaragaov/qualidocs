
-- 1) Restrict insert: users may only request non-privileged roles.
DROP POLICY IF EXISTS "ar_insert_self" ON public.access_requests;
CREATE POLICY "ar_insert_self" ON public.access_requests
  FOR INSERT TO authenticated
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'pending'
    AND requested_role IN ('collaborator','viewer')
  );

-- 2) Narrow self-update: only allow cancelling a still-pending request,
--    and forbid changing requested_role.
DROP POLICY IF EXISTS "ar_update_self_cancel" ON public.access_requests;
CREATE POLICY "ar_update_self_cancel" ON public.access_requests
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND status = 'pending')
  WITH CHECK (
    user_id = auth.uid()
    AND status = 'cancelled'
    AND requested_role IN ('collaborator','viewer')
  );

-- 3) Defense-in-depth inside the approval RPC: never grant owner/admin
--    through the request flow, even if a legacy row slipped through.
CREATE OR REPLACE FUNCTION public.tms_decide_access_request(_request_id uuid, _approve boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_uid uuid := auth.uid();
  r public.access_requests%ROWTYPE;
  v_role public.project_role;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Autenticação necessária'; END IF;
  SELECT * INTO r FROM public.access_requests WHERE id = _request_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Solicitação não encontrada'; END IF;
  IF NOT public.tms_can_manage(r.project_id) THEN RAISE EXCEPTION 'Sem permissão'; END IF;
  IF r.status <> 'pending' THEN RAISE EXCEPTION 'Solicitação já foi decidida'; END IF;

  IF _approve THEN
    -- Coerce any privileged role request down to 'collaborator'.
    v_role := CASE
      WHEN r.requested_role IN ('collaborator','viewer') THEN r.requested_role
      ELSE 'collaborator'::public.project_role
    END;

    INSERT INTO public.project_members (project_id, user_id, role, status, accepted_at, invited_by)
    VALUES (r.project_id, r.user_id, v_role, 'accepted', now(), v_uid)
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
END; $function$;

-- Preserve the earlier lockdown: only authenticated users may execute it.
REVOKE ALL ON FUNCTION public.tms_decide_access_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tms_decide_access_request(uuid, boolean) TO authenticated;

-- Normalize any existing pending rows so the tighter insert check matches reality.
UPDATE public.access_requests
   SET requested_role = 'collaborator'
 WHERE status = 'pending'
   AND requested_role NOT IN ('collaborator','viewer');
