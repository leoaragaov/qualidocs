DROP POLICY IF EXISTS "owners manage project tags" ON public.project_tags;
DROP POLICY IF EXISTS "owners insert project tags" ON public.project_tags;
DROP POLICY IF EXISTS "owners update project tags" ON public.project_tags;
DROP POLICY IF EXISTS "owners delete project tags" ON public.project_tags;
DROP POLICY IF EXISTS "owners and project members view project tags" ON public.project_tags;

CREATE POLICY "owners and project members view project tags" ON public.project_tags
  FOR SELECT TO authenticated
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1
      FROM public.project_tag_links l
      WHERE l.tag_id = project_tags.id
        AND public.tms_can_view(l.project_id)
    )
  );

CREATE POLICY "owners insert project tags" ON public.project_tags
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owners update project tags" ON public.project_tags
  FOR UPDATE TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE POLICY "owners delete project tags" ON public.project_tags
  FOR DELETE TO authenticated
  USING (owner_id = auth.uid());