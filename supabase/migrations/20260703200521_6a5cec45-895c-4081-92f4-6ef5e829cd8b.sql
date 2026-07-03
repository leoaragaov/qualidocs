
-- Revoke default PUBLIC EXECUTE on all SECURITY DEFINER functions,
-- then re-grant EXECUTE only where the app truly calls them.

-- Trigger functions (called by Postgres, never by clients)
REVOKE ALL ON FUNCTION public.tms_audit_row() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tms_add_owner_member() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tms_notify_invitation_accepted() FROM PUBLIC, anon, authenticated;

-- Internal helper (called from other SECURITY DEFINER functions only)
REVOKE ALL ON FUNCTION public.tms_notify_managers(uuid, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;

-- RLS helpers — used inside policies. Policies evaluate as the table owner,
-- so clients don't need EXECUTE. Lock them down.
REVOKE ALL ON FUNCTION public.tms_project_role(uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tms_can_view(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tms_can_write(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tms_can_manage(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.tms_is_owner(uuid) FROM PUBLIC, anon, authenticated;

-- RPCs intentionally exposed to signed-in users only
REVOKE ALL ON FUNCTION public.tms_join_by_code(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tms_join_by_code(text) TO authenticated;

REVOKE ALL ON FUNCTION public.tms_request_access(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tms_request_access(uuid, text) TO authenticated;

REVOKE ALL ON FUNCTION public.tms_decide_access_request(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.tms_decide_access_request(uuid, boolean) TO authenticated;

-- Public preview — used by the request-access screen (may be reached before sign-in)
REVOKE ALL ON FUNCTION public.tms_project_preview(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.tms_project_preview(uuid) TO anon, authenticated;
