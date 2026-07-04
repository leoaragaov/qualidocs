GRANT EXECUTE ON FUNCTION public.tms_project_role(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tms_can_view(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tms_can_write(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tms_can_manage(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.tms_is_owner(uuid) TO authenticated;