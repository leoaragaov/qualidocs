
-- Enums
CREATE TYPE public.test_status AS ENUM ('Pendente', 'Passou', 'Falhou', 'Bloqueado');
CREATE TYPE public.bug_severity AS ENUM ('Alta', 'Média', 'Baixa');
CREATE TYPE public.bug_status AS ENUM ('Aberto', 'Em Correção', 'Corrigido', 'Retestado');
CREATE TYPE public.audit_action AS ENUM ('create', 'update', 'delete');

-- updated_at helper
CREATE OR REPLACE FUNCTION public.tms_touch_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

-- =============== projects ===============
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  projeto TEXT NOT NULL DEFAULT '',
  versao TEXT NOT NULL DEFAULT '',
  responsavel TEXT NOT NULL DEFAULT '',
  ambiente TEXT NOT NULL DEFAULT '',
  data_criacao DATE,
  ultima_revisao DATE,
  objetivo TEXT NOT NULL DEFAULT '',
  in_scope TEXT NOT NULL DEFAULT '',
  out_of_scope TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.projects TO authenticated;
GRANT ALL ON public.projects TO service_role;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.projects FOR ALL TO authenticated
  USING (owner_id = auth.uid()) WITH CHECK (owner_id = auth.uid());
CREATE TRIGGER projects_touch BEFORE UPDATE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();

-- Helper to check project ownership (SECURITY DEFINER avoids recursion)
CREATE OR REPLACE FUNCTION public.tms_owns_project(_project_id UUID)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = auth.uid())
$$;

-- =============== schedule_items ===============
CREATE TABLE public.schedule_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 0,
  fase TEXT DEFAULT '', atividade TEXT DEFAULT '',
  inicio DATE, fim DATE,
  responsavel TEXT DEFAULT '', status TEXT DEFAULT 'A Fazer',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.schedule_items TO authenticated;
GRANT ALL ON public.schedule_items TO service_role;
ALTER TABLE public.schedule_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own schedule" ON public.schedule_items FOR ALL TO authenticated
  USING (public.tms_owns_project(project_id)) WITH CHECK (public.tms_owns_project(project_id));

-- =============== risks ===============
CREATE TABLE public.risks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 0,
  risco_id TEXT DEFAULT '', descricao TEXT DEFAULT '',
  probabilidade TEXT DEFAULT 'Média', impacto TEXT DEFAULT 'Médio',
  mitigacao TEXT DEFAULT '', responsavel TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.risks TO authenticated;
GRANT ALL ON public.risks TO service_role;
ALTER TABLE public.risks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own risks" ON public.risks FOR ALL TO authenticated
  USING (public.tms_owns_project(project_id)) WITH CHECK (public.tms_owns_project(project_id));

-- =============== user_stories ===============
CREATE TABLE public.user_stories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  us_id TEXT DEFAULT '',
  modulo TEXT DEFAULT '', ator TEXT DEFAULT '', story TEXT DEFAULT '',
  criterio1 TEXT DEFAULT '', criterio2 TEXT DEFAULT '',
  prioridade TEXT DEFAULT 'Média', sprint TEXT DEFAULT '',
  status TEXT DEFAULT 'A Documentar',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_stories TO authenticated;
GRANT ALL ON public.user_stories TO service_role;
ALTER TABLE public.user_stories ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own us" ON public.user_stories FOR ALL TO authenticated
  USING (public.tms_owns_project(project_id)) WITH CHECK (public.tms_owns_project(project_id));
CREATE TRIGGER user_stories_touch BEFORE UPDATE ON public.user_stories
  FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();

-- =============== test_cases ===============
CREATE TABLE public.test_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  ct_id TEXT DEFAULT '', id_us TEXT DEFAULT '',
  modulo TEXT DEFAULT '', tipo TEXT DEFAULT 'Funcional',
  precondicoes TEXT DEFAULT '', massa TEXT DEFAULT '',
  passos TEXT DEFAULT '', esperado TEXT DEFAULT '',
  obtido TEXT DEFAULT '',
  status public.test_status NOT NULL DEFAULT 'Pendente',
  evidencia TEXT DEFAULT '', observacoes TEXT DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.test_cases TO authenticated;
GRANT ALL ON public.test_cases TO service_role;
ALTER TABLE public.test_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own ct" ON public.test_cases FOR ALL TO authenticated
  USING (public.tms_owns_project(project_id)) WITH CHECK (public.tms_owns_project(project_id));
CREATE TRIGGER test_cases_touch BEFORE UPDATE ON public.test_cases
  FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();

-- =============== bugs ===============
CREATE TABLE public.bugs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_case_id UUID REFERENCES public.test_cases(id) ON DELETE SET NULL,
  bug_id TEXT DEFAULT '',
  titulo TEXT DEFAULT '',
  severidade public.bug_severity NOT NULL DEFAULT 'Média',
  comportamento_atual TEXT DEFAULT '',
  comportamento_esperado TEXT DEFAULT '',
  passos TEXT DEFAULT '',
  massa TEXT DEFAULT '',
  status public.bug_status NOT NULL DEFAULT 'Aberto',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.bugs TO authenticated;
GRANT ALL ON public.bugs TO service_role;
ALTER TABLE public.bugs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own bugs" ON public.bugs FOR ALL TO authenticated
  USING (public.tms_owns_project(project_id)) WITH CHECK (public.tms_owns_project(project_id));
CREATE TRIGGER bugs_touch BEFORE UPDATE ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.tms_touch_updated_at();

-- =============== audit_logs ===============
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  actor_id UUID,
  entity TEXT NOT NULL,
  entity_id UUID,
  action public.audit_action NOT NULL,
  diff JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.audit_logs TO authenticated;
GRANT ALL ON public.audit_logs TO service_role;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own audit read" ON public.audit_logs FOR SELECT TO authenticated
  USING (project_id IS NOT NULL AND public.tms_owns_project(project_id));
CREATE POLICY "own audit insert" ON public.audit_logs FOR INSERT TO authenticated
  WITH CHECK (actor_id = auth.uid());
CREATE INDEX audit_logs_project_idx ON public.audit_logs (project_id, created_at DESC);

-- =============== Audit trigger ===============
CREATE OR REPLACE FUNCTION public.tms_audit_row()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_project UUID;
  v_entity_id UUID;
  v_action public.audit_action;
  v_diff JSONB;
BEGIN
  IF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_entity_id := OLD.id;
    v_diff := to_jsonb(OLD);
    IF TG_TABLE_NAME = 'projects' THEN v_project := OLD.id;
    ELSE v_project := OLD.project_id; END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_entity_id := NEW.id;
    v_diff := jsonb_build_object('old', to_jsonb(OLD), 'new', to_jsonb(NEW));
    IF TG_TABLE_NAME = 'projects' THEN v_project := NEW.id;
    ELSE v_project := NEW.project_id; END IF;
  ELSE -- INSERT
    v_action := 'create';
    v_entity_id := NEW.id;
    v_diff := to_jsonb(NEW);
    IF TG_TABLE_NAME = 'projects' THEN v_project := NEW.id;
    ELSE v_project := NEW.project_id; END IF;
  END IF;

  INSERT INTO public.audit_logs (project_id, actor_id, entity, entity_id, action, diff)
  VALUES (v_project, auth.uid(), TG_TABLE_NAME, v_entity_id, v_action, v_diff);

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END; $$;

CREATE TRIGGER projects_audit AFTER INSERT OR UPDATE OR DELETE ON public.projects
  FOR EACH ROW EXECUTE FUNCTION public.tms_audit_row();
CREATE TRIGGER schedule_items_audit AFTER INSERT OR UPDATE OR DELETE ON public.schedule_items
  FOR EACH ROW EXECUTE FUNCTION public.tms_audit_row();
CREATE TRIGGER risks_audit AFTER INSERT OR UPDATE OR DELETE ON public.risks
  FOR EACH ROW EXECUTE FUNCTION public.tms_audit_row();
CREATE TRIGGER user_stories_audit AFTER INSERT OR UPDATE OR DELETE ON public.user_stories
  FOR EACH ROW EXECUTE FUNCTION public.tms_audit_row();
CREATE TRIGGER test_cases_audit AFTER INSERT OR UPDATE OR DELETE ON public.test_cases
  FOR EACH ROW EXECUTE FUNCTION public.tms_audit_row();
CREATE TRIGGER bugs_audit AFTER INSERT OR UPDATE OR DELETE ON public.bugs
  FOR EACH ROW EXECUTE FUNCTION public.tms_audit_row();
