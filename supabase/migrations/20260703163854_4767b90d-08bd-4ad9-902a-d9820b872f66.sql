
REVOKE EXECUTE ON FUNCTION public.tms_owns_project(UUID) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tms_audit_row() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.tms_touch_updated_at() FROM PUBLIC, anon, authenticated;
