
-- 1. Add execution tracking columns to test_cases
ALTER TABLE public.test_cases
  ADD COLUMN IF NOT EXISTS executado_em TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS executor TEXT DEFAULT '';

-- 2. Historic executions table
CREATE TABLE IF NOT EXISTS public.historico_execucoes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  test_case_id UUID NOT NULL REFERENCES public.test_cases(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  obtido TEXT NOT NULL DEFAULT '',
  evidencia TEXT NOT NULL DEFAULT '',
  executor TEXT NOT NULL DEFAULT '',
  executed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_execucoes_project ON public.historico_execucoes(project_id, executed_at DESC);
CREATE INDEX IF NOT EXISTS idx_historico_execucoes_test_case ON public.historico_execucoes(test_case_id, executed_at DESC);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.historico_execucoes TO authenticated;
GRANT ALL ON public.historico_execucoes TO service_role;

ALTER TABLE public.historico_execucoes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage historico_execucoes"
  ON public.historico_execucoes
  FOR ALL
  TO authenticated
  USING (public.tms_owns_project(project_id))
  WITH CHECK (public.tms_owns_project(project_id));
