
-- 1) Access requests: enforce column-level immutability on self-cancel.
--    The RLS policy already restricts USING to (pending & self) and
--    WITH CHECK to (cancelled & self). This trigger additionally
--    guarantees that a self-update changes ONLY the status column.
CREATE OR REPLACE FUNCTION public.tms_ar_self_cancel_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  -- Managers/service_role updates bypass this guard: they legitimately
  -- change decided_by/decided_at/status. Only constrain the requester.
  IF auth.uid() IS NOT NULL AND auth.uid() = OLD.user_id THEN
    IF NEW.status <> 'cancelled' THEN
      RAISE EXCEPTION 'Requester may only cancel their own request';
    END IF;
    IF NEW.project_id     IS DISTINCT FROM OLD.project_id
    OR NEW.user_id        IS DISTINCT FROM OLD.user_id
    OR NEW.message        IS DISTINCT FROM OLD.message
    OR NEW.requested_role IS DISTINCT FROM OLD.requested_role
    OR NEW.decided_by     IS DISTINCT FROM OLD.decided_by
    OR NEW.decided_at     IS DISTINCT FROM OLD.decided_at
    OR NEW.created_at     IS DISTINCT FROM OLD.created_at THEN
      RAISE EXCEPTION 'Only the status column may change on self-cancel';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ar_self_cancel_guard ON public.access_requests;
CREATE TRIGGER trg_ar_self_cancel_guard
BEFORE UPDATE ON public.access_requests
FOR EACH ROW EXECUTE FUNCTION public.tms_ar_self_cancel_guard();

-- Keep the trigger function locked down.
REVOKE ALL ON FUNCTION public.tms_ar_self_cancel_guard() FROM PUBLIC, anon, authenticated;

-- 2) Notifications: deny all direct client inserts. All legitimate inserts
--    happen through SECURITY DEFINER helpers (tms_notify_managers,
--    tms_decide_access_request) or the service role, both of which bypass
--    this policy. A restrictive policy makes the intent explicit and
--    survives any future FOR ALL policy someone might add.
DROP POLICY IF EXISTS "notifications_no_client_insert" ON public.notifications;
CREATE POLICY "notifications_no_client_insert" ON public.notifications
  AS RESTRICTIVE
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (false);
