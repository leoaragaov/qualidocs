
-- ==== Enums ====
DO $$ BEGIN
  CREATE TYPE public.project_role AS ENUM ('owner','admin','collaborator','viewer');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.invitation_status AS ENUM ('pending','accepted','revoked','expired');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.member_status AS ENUM ('pending','accepted');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==== project_members ====
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.project_role NOT NULL DEFAULT 'viewer',
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  invited_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  status public.member_status NOT NULL DEFAULT 'accepted',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, user_id)
);
CREATE INDEX IF NOT EXISTS project_members_project_idx ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS project_members_user_idx ON public.project_members(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_members TO authenticated;
GRANT ALL ON public.project_members TO service_role;

-- ==== project_invitations ====
CREATE TABLE IF NOT EXISTS public.project_invitations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  email text NOT NULL,
  role public.project_role NOT NULL DEFAULT 'viewer',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24),'hex'),
  invited_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  expires_at timestamptz NOT NULL DEFAULT (now() + interval '14 days'),
  accepted_at timestamptz,
  accepted_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status public.invitation_status NOT NULL DEFAULT 'pending',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS project_invitations_project_idx ON public.project_invitations(project_id);
CREATE INDEX IF NOT EXISTS project_invitations_email_idx ON public.project_invitations(lower(email));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_invitations TO authenticated;
GRANT ALL ON public.project_invitations TO service_role;

-- ==== updated_at triggers ====
DROP TRIGGER IF EXISTS trg_project_members_touch ON public.project_members;
CREATE TRIGGER trg_project_members_touch BEFORE UPDATE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();

DROP TRIGGER IF EXISTS trg_project_invitations_touch ON public.project_invitations;
CREATE TRIGGER trg_project_invitations_touch BEFORE UPDATE ON public.project_invitations
FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();

-- ==== Auto add owner as member on new project ====
CREATE OR REPLACE FUNCTION public.tms_add_owner_member()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.project_members (project_id, user_id, role, status, accepted_at, invited_by)
  VALUES (NEW.id, NEW.owner_id, 'owner', 'accepted', now(), NEW.owner_id)
  ON CONFLICT (project_id, user_id) DO NOTHING;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_projects_owner_member ON public.projects;
CREATE TRIGGER trg_projects_owner_member AFTER INSERT ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.tms_add_owner_member();

-- Backfill existing projects
INSERT INTO public.project_members (project_id, user_id, role, status, accepted_at, invited_by)
SELECT id, owner_id, 'owner', 'accepted', now(), owner_id FROM public.projects
WHERE owner_id IS NOT NULL
ON CONFLICT (project_id, user_id) DO NOTHING;

-- ==== Security-definer access helpers ====
CREATE OR REPLACE FUNCTION public.tms_project_role(_pid uuid, _uid uuid)
RETURNS public.project_role LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT role FROM public.project_members
  WHERE project_id = _pid AND user_id = _uid AND status = 'accepted'
  LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.tms_can_view(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.tms_project_role(_pid, auth.uid()) IS NOT NULL
$$;

CREATE OR REPLACE FUNCTION public.tms_can_write(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.tms_project_role(_pid, auth.uid()) IN ('owner','admin','collaborator')
$$;

CREATE OR REPLACE FUNCTION public.tms_can_manage(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.tms_project_role(_pid, auth.uid()) IN ('owner','admin')
$$;

CREATE OR REPLACE FUNCTION public.tms_is_owner(_pid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.tms_project_role(_pid, auth.uid()) = 'owner'
$$;

-- ==== Replace RLS policies on projects and child tables ====

-- projects
DROP POLICY IF EXISTS "own projects" ON public.projects;
CREATE POLICY "members view projects" ON public.projects
  FOR SELECT TO authenticated
  USING (public.tms_can_view(id));
CREATE POLICY "insert own projects" ON public.projects
  FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
CREATE POLICY "managers update projects" ON public.projects
  FOR UPDATE TO authenticated
  USING (public.tms_can_manage(id))
  WITH CHECK (public.tms_can_manage(id));
CREATE POLICY "owner delete projects" ON public.projects
  FOR DELETE TO authenticated
  USING (public.tms_is_owner(id));

-- Helper to rewrite child-table policies (view=member, write=collaborator+)
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schedule_items','risks','user_stories','test_cases','bugs','historico_execucoes']
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "own %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "Owners manage %s" ON public.%I', t, t);
    EXECUTE format('DROP POLICY IF EXISTS "own ct" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "own us" ON public.%I', t);
    EXECUTE format('CREATE POLICY "members view %s" ON public.%I FOR SELECT TO authenticated USING (public.tms_can_view(project_id))', t, t);
    EXECUTE format('CREATE POLICY "writers modify %s" ON public.%I FOR INSERT TO authenticated WITH CHECK (public.tms_can_write(project_id))', t, t);
    EXECUTE format('CREATE POLICY "writers update %s" ON public.%I FOR UPDATE TO authenticated USING (public.tms_can_write(project_id)) WITH CHECK (public.tms_can_write(project_id))', t, t);
    EXECUTE format('CREATE POLICY "writers delete %s" ON public.%I FOR DELETE TO authenticated USING (public.tms_can_write(project_id))', t, t);
  END LOOP;
END $$;

-- audit_logs (read for members; insert kept)
DROP POLICY IF EXISTS "own audit read" ON public.audit_logs;
CREATE POLICY "members view audit" ON public.audit_logs
  FOR SELECT TO authenticated
  USING (project_id IS NOT NULL AND public.tms_can_view(project_id));

-- ==== RLS on project_members ====
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "members view membership" ON public.project_members
  FOR SELECT TO authenticated
  USING (public.tms_can_view(project_id));

CREATE POLICY "managers add members" ON public.project_members
  FOR INSERT TO authenticated
  WITH CHECK (public.tms_can_manage(project_id));

CREATE POLICY "managers update members" ON public.project_members
  FOR UPDATE TO authenticated
  USING (public.tms_can_manage(project_id) AND role <> 'owner')
  WITH CHECK (public.tms_can_manage(project_id) AND role <> 'owner');

CREATE POLICY "managers remove members" ON public.project_members
  FOR DELETE TO authenticated
  USING (public.tms_can_manage(project_id) AND role <> 'owner');

CREATE POLICY "self remove membership" ON public.project_members
  FOR DELETE TO authenticated
  USING (user_id = auth.uid() AND role <> 'owner');

-- ==== RLS on project_invitations ====
ALTER TABLE public.project_invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "managers view invitations" ON public.project_invitations
  FOR SELECT TO authenticated
  USING (public.tms_can_manage(project_id));

CREATE POLICY "managers create invitations" ON public.project_invitations
  FOR INSERT TO authenticated
  WITH CHECK (public.tms_can_manage(project_id));

CREATE POLICY "managers update invitations" ON public.project_invitations
  FOR UPDATE TO authenticated
  USING (public.tms_can_manage(project_id))
  WITH CHECK (public.tms_can_manage(project_id));

CREATE POLICY "managers delete invitations" ON public.project_invitations
  FOR DELETE TO authenticated
  USING (public.tms_can_manage(project_id));
