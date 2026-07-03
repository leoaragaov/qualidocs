
-- Switch ownership check to SECURITY INVOKER; projects RLS already filters to own rows.
CREATE OR REPLACE FUNCTION public.tms_owns_project(_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = auth.uid())
$$;
GRANT EXECUTE ON FUNCTION public.tms_owns_project(UUID) TO authenticated;

-- Audit trigger stays SECURITY DEFINER (needed to insert into audit_logs bypassing potential future restrictions),
-- but revoke direct EXECUTE so users cannot call it outside triggers. Trigger execution ignores EXECUTE grants.
-- Already revoked in previous migration.

-- Touch trigger doesn't need SECURITY DEFINER
CREATE OR REPLACE FUNCTION public.tms_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;
