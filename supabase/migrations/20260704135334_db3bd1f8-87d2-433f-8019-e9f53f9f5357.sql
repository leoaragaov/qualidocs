-- Fix 1: audit_logs — remove permissive client INSERT policy.
-- Audit rows are inserted exclusively by the SECURITY DEFINER trigger tms_audit_row(),
-- which bypasses RLS. Removing this policy prevents authenticated users from
-- fabricating audit entries via the Data API.
DROP POLICY IF EXISTS "own audit insert" ON public.audit_logs;

-- Fix 2: project_invitations.token — remove column read access from authenticated.
-- Managers no longer see raw invitation tokens through the Data API. Server functions
-- that legitimately need the token (listInvitations, resendInvitation, acceptInvitation)
-- use the service-role client after verifying tms_can_manage(project_id).
REVOKE SELECT (token) ON public.project_invitations FROM authenticated;
-- service_role keeps full access (already granted via GRANT ALL) for server-side use.
