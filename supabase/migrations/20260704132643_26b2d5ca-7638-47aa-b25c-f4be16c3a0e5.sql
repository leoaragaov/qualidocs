CREATE TABLE IF NOT EXISTS public.project_tags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT 'blue',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT project_tags_name_not_blank CHECK (length(trim(name)) > 0),
  CONSTRAINT project_tags_color_not_blank CHECK (length(trim(color)) > 0),
  CONSTRAINT project_tags_owner_name_unique UNIQUE (owner_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tags TO authenticated;
GRANT ALL ON public.project_tags TO service_role;
ALTER TABLE public.project_tags ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "owners manage project tags" ON public.project_tags;
CREATE POLICY "owners manage project tags" ON public.project_tags
  FOR ALL TO authenticated
  USING (owner_id = auth.uid())
  WITH CHECK (owner_id = auth.uid());

CREATE TABLE IF NOT EXISTS public.project_tag_links (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  tag_id UUID NOT NULL REFERENCES public.project_tags(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, tag_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_tag_links TO authenticated;
GRANT ALL ON public.project_tag_links TO service_role;
ALTER TABLE public.project_tag_links ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "members view project tag links" ON public.project_tag_links;
DROP POLICY IF EXISTS "managers add project tag links" ON public.project_tag_links;
DROP POLICY IF EXISTS "managers update project tag links" ON public.project_tag_links;
DROP POLICY IF EXISTS "managers remove project tag links" ON public.project_tag_links;
CREATE POLICY "members view project tag links" ON public.project_tag_links
  FOR SELECT TO authenticated
  USING (public.tms_can_view(project_id));
CREATE POLICY "managers add project tag links" ON public.project_tag_links
  FOR INSERT TO authenticated
  WITH CHECK (
    public.tms_can_manage(project_id)
    AND EXISTS (
      SELECT 1 FROM public.project_tags t
      WHERE t.id = tag_id AND t.owner_id = auth.uid()
    )
  );
CREATE POLICY "managers update project tag links" ON public.project_tag_links
  FOR UPDATE TO authenticated
  USING (public.tms_can_manage(project_id))
  WITH CHECK (
    public.tms_can_manage(project_id)
    AND EXISTS (
      SELECT 1 FROM public.project_tags t
      WHERE t.id = tag_id AND t.owner_id = auth.uid()
    )
  );
CREATE POLICY "managers remove project tag links" ON public.project_tag_links
  FOR DELETE TO authenticated
  USING (public.tms_can_manage(project_id));

DROP TRIGGER IF EXISTS project_tags_touch ON public.project_tags;
CREATE TRIGGER project_tags_touch BEFORE UPDATE ON public.project_tags
  FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();

CREATE INDEX IF NOT EXISTS project_tags_owner_idx ON public.project_tags(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS project_tag_links_tag_idx ON public.project_tag_links(tag_id);

WITH legacy_tags AS (
  SELECT
    p.id AS project_id,
    p.owner_id,
    trim((tag_item->>'name')) AS name,
    COALESCE(NULLIF(trim(tag_item->>'color'), ''), 'blue') AS color
  FROM public.projects p
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(p.tags, '[]'::jsonb)) AS tag_item
  WHERE jsonb_typeof(COALESCE(p.tags, '[]'::jsonb)) = 'array'
    AND trim(COALESCE(tag_item->>'name', '')) <> ''
), inserted_tags AS (
  INSERT INTO public.project_tags (owner_id, name, color)
  SELECT DISTINCT ON (owner_id, name) owner_id, name, color
  FROM legacy_tags
  ORDER BY owner_id, name, color
  ON CONFLICT (owner_id, name) DO UPDATE SET color = EXCLUDED.color
  RETURNING id, owner_id, name
)
INSERT INTO public.project_tag_links (project_id, tag_id)
SELECT DISTINCT lt.project_id, pt.id
FROM legacy_tags lt
JOIN public.project_tags pt ON pt.owner_id = lt.owner_id AND pt.name = lt.name
ON CONFLICT DO NOTHING;