// Shared shapes returned by TMS server functions. Kept minimal & serializable.

export type TmsJson = string | number | boolean | null | { [k: string]: TmsJson } | TmsJson[];


export type TmsProjectRow = {
  id: string;
  projeto: string;
  versao: string;
  responsavel: string;
  ambiente: string;
  data_criacao: string | null;
  ultima_revisao: string | null;
  objetivo: string;
  in_scope: string;
  out_of_scope: string;
  codigo_acesso: string | null;
  created_at: string;
  updated_at: string;
};

export type TmsSchedule = {
  id: string;
  project_id: string;
  ordem: number;
  fase: string;
  atividade: string;
  inicio: string | null;
  fim: string | null;
  responsavel: string;
  status: string;
};

export type TmsRisk = {
  id: string;
  project_id: string;
  ordem: number;
  risco_id: string;
  descricao: string;
  probabilidade: string;
  impacto: string;
  mitigacao: string;
  responsavel: string;
};

export type TmsUserStory = {
  id: string;
  project_id: string;
  us_id: string;
  modulo: string;
  ator: string;
  story: string;
  criterio1: string;
  criterio2: string;
  prioridade: string;
  sprint: string;
  status: string;
};

export type TestStatus = "Pendente" | "Passou" | "Falhou" | "Bloqueado";

export type TmsTestCase = {
  id: string;
  project_id: string;
  ct_id: string;
  id_us: string;
  modulo: string;
  tipo: string;
  precondicoes: string;
  massa: string;
  passos: string;
  esperado: string;
  obtido: string;
  status: TestStatus;
  evidencia: string;
  observacoes: string;
  executado_em: string | null;
  executor: string;
};

export type TmsExecHistory = {
  id: string;
  project_id: string;
  test_case_id: string;
  status: string;
  obtido: string;
  evidencia: string;
  executor: string;
  executed_at: string;
  created_at: string;
};

export type BugSeverity = "Alta" | "Média" | "Baixa";
export type BugStatus = "Aberto" | "Em Correção" | "Corrigido" | "Retestado";

export type TmsBug = {
  id: string;
  project_id: string;
  test_case_id: string | null;
  bug_id: string;
  titulo: string;
  severidade: BugSeverity;
  comportamento_atual: string;
  comportamento_esperado: string;
  passos: string;
  massa: string;
  status: BugStatus;
  created_at: string;
  updated_at: string;
};

export type TmsAuditLog = {
  id: string;
  project_id: string | null;
  actor_id: string | null;
  entity: string;
  entity_id: string | null;
  action: "create" | "update" | "delete";
  // JSON payload with old/new snapshots depending on action
  diff: TmsJson | null;
  created_at: string;
};

export type TmsProjectDetail = {
  project: TmsProjectRow;
  schedule: TmsSchedule[];
  risks: TmsRisk[];
  userStories: TmsUserStory[];
  testCases: TmsTestCase[];
  bugs: TmsBug[];
};
