import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type {
  TmsProjectDetail,
  TmsProjectRow,
  TmsProjectDetail,
  TmsProjectRow,
  TmsBug,
  TmsAuditLog,
  TmsSchedule,
  TmsRisk,
  TmsUserStory,
  TmsTestCase,
  TmsExecHistory,
  TmsTestCase,
} from "./tms-types";

// ---------- Projects ----------

export const listProjects = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("projects")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return (data ?? []) as TmsProjectRow[];
  });

export const createProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ projeto: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("projects")
      .insert({ owner_id: context.userId, projeto: data.projeto })
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as TmsProjectRow;
  });

export const deleteProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("projects").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const planoSchema = z.object({
  id: z.string().uuid(),
  projeto: z.string().max(200),
  versao: z.string().max(100),
  responsavel: z.string().max(200),
  ambiente: z.string().max(200),
  data_criacao: z.string().nullable(),
  ultima_revisao: z.string().nullable(),
  objetivo: z.string().max(5000),
  in_scope: z.string().max(5000),
  out_of_scope: z.string().max(5000),
});

export const updateProject = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => planoSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { id, ...rest } = data;
    const { error } = await context.supabase.from("projects").update(rest).eq("id", id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Full detail ----------

export const getProjectDetail = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }): Promise<TmsProjectDetail> => {
    const sb = context.supabase;
    const pid = data.id;
    const [proj, sched, risks, us, ct, bugs] = await Promise.all([
      sb.from("projects").select("*").eq("id", pid).maybeSingle(),
      sb.from("schedule_items").select("*").eq("project_id", pid).order("ordem"),
      sb.from("risks").select("*").eq("project_id", pid).order("ordem"),
      sb.from("user_stories").select("*").eq("project_id", pid).order("created_at"),
      sb.from("test_cases").select("*").eq("project_id", pid).order("created_at"),
      sb.from("bugs").select("*").eq("project_id", pid).order("created_at", { ascending: false }),
    ]);
    if (proj.error || !proj.data) throw new Error(proj.error?.message ?? "Projeto não encontrado");
    return {
      project: proj.data as TmsProjectRow,
      schedule: (sched.data ?? []) as TmsSchedule[],
      risks: (risks.data ?? []) as TmsRisk[],
      userStories: (us.data ?? []) as TmsUserStory[],
      testCases: (ct.data ?? []) as TmsTestCase[],
      bugs: (bugs.data ?? []) as TmsBug[],
    };
  });

// ---------- Generic child upsert/delete ----------

const scheduleSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  ordem: z.number().int().default(0),
  fase: z.string().max(200).default(""),
  atividade: z.string().max(500).default(""),
  inicio: z.string().nullable().default(null),
  fim: z.string().nullable().default(null),
  responsavel: z.string().max(200).default(""),
  status: z.string().max(50).default("A Fazer"),
});
export const upsertSchedule = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => scheduleSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("schedule_items")
      .upsert(data)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as TmsSchedule;
  });

const riskSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  ordem: z.number().int().default(0),
  risco_id: z.string().max(50).default(""),
  descricao: z.string().max(2000).default(""),
  probabilidade: z.string().max(50).default("Média"),
  impacto: z.string().max(50).default("Médio"),
  mitigacao: z.string().max(2000).default(""),
  responsavel: z.string().max(200).default(""),
});
export const upsertRisk = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => riskSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase.from("risks").upsert(data).select("*").single();
    if (error) throw new Error(error.message);
    return row as TmsRisk;
  });

const usSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  us_id: z.string().max(50).default(""),
  modulo: z.string().max(200).default(""),
  ator: z.string().max(200).default(""),
  story: z.string().max(2000).default(""),
  criterio1: z.string().max(2000).default(""),
  criterio2: z.string().max(2000).default(""),
  prioridade: z.string().max(50).default("Média"),
  sprint: z.string().max(50).default(""),
  status: z.string().max(50).default("A Documentar"),
});
export const upsertUserStory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => usSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("user_stories")
      .upsert(data)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as TmsUserStory;
  });

const ctSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  ct_id: z.string().max(50).default(""),
  id_us: z.string().max(200).default(""),
  modulo: z.string().max(200).default(""),
  tipo: z.string().max(50).default("Funcional"),
  precondicoes: z.string().max(4000).default(""),
  massa: z.string().max(4000).default(""),
  passos: z.string().max(4000).default(""),
  esperado: z.string().max(4000).default(""),
  obtido: z.string().max(4000).default(""),
  status: z.enum(["Pendente", "Passou", "Falhou", "Bloqueado"]).default("Pendente"),
  evidencia: z.string().max(500).default(""),
  observacoes: z.string().max(4000).default(""),
});
export const upsertTestCase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ctSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase
      .from("test_cases")
      .upsert(data)
      .select("*")
      .single();
    if (error) throw new Error(error.message);
    return row as TmsTestCase;
  });

export const setTestCaseStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["Pendente", "Passou", "Falhou", "Bloqueado"]),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("test_cases")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Bugs ----------

const bugSchema = z.object({
  id: z.string().uuid().optional(),
  project_id: z.string().uuid(),
  test_case_id: z.string().uuid().nullable().optional(),
  bug_id: z.string().max(50).default(""),
  titulo: z.string().max(300).default(""),
  severidade: z.enum(["Alta", "Média", "Baixa"]).default("Média"),
  comportamento_atual: z.string().max(4000).default(""),
  comportamento_esperado: z.string().max(4000).default(""),
  passos: z.string().max(4000).default(""),
  massa: z.string().max(4000).default(""),
  status: z.enum(["Aberto", "Em Correção", "Corrigido", "Retestado"]).default("Aberto"),
});
export const upsertBug = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => bugSchema.parse(d))
  .handler(async ({ data, context }) => {
    const { error, data: row } = await context.supabase.from("bugs").upsert(data).select("*").single();
    if (error) throw new Error(error.message);
    return row as TmsBug;
  });

// ---------- Delete any child ----------

export const deleteRow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) =>
    z.object({
      table: z.enum(["schedule_items", "risks", "user_stories", "test_cases", "bugs"]),
      id: z.string().uuid(),
    }).parse(d),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from(data.table).delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ---------- Audit ----------

export const listAudit = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => z.object({ project_id: z.string().uuid() }).parse(d))
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("audit_logs")
      .select("*")
      .eq("project_id", data.project_id)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw new Error(error.message);
    return (rows ?? []) as TmsAuditLog[];
  });

// ---------- Bulk import (from local draft) ----------

const importPayload = z.object({
  projeto: z.string().default(""),
  versao: z.string().default(""),
  responsavel: z.string().default(""),
  ambiente: z.string().default(""),
  data_criacao: z.string().nullable().default(null),
  ultima_revisao: z.string().nullable().default(null),
  objetivo: z.string().default(""),
  in_scope: z.string().default(""),
  out_of_scope: z.string().default(""),
  cronograma: z.array(z.any()).default([]),
  riscos: z.array(z.any()).default([]),
  userStories: z.array(z.any()).default([]),
  casosTeste: z.array(z.any()).default([]),
});

export const importDraft = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => importPayload.parse(d))
  .handler(async ({ data, context }) => {
    const sb = context.supabase;
    const { data: proj, error } = await sb
      .from("projects")
      .insert({
        owner_id: context.userId,
        projeto: data.projeto || "Projeto importado",
        versao: data.versao,
        responsavel: data.responsavel,
        ambiente: data.ambiente,
        data_criacao: data.data_criacao || null,
        ultima_revisao: data.ultima_revisao || null,
        objetivo: data.objetivo,
        in_scope: data.in_scope,
        out_of_scope: data.out_of_scope,
      })
      .select("*")
      .single();
    if (error || !proj) throw new Error(error?.message ?? "Falha ao criar projeto");
    const pid = proj.id;

    if (data.cronograma.length) {
      await sb.from("schedule_items").insert(
        data.cronograma.map((r: any, i: number) => ({
          project_id: pid,
          ordem: i,
          fase: r.fase ?? "",
          atividade: r.atividade ?? "",
          inicio: r.inicio || null,
          fim: r.fim || null,
          responsavel: r.responsavel ?? "",
          status: r.status ?? "A Fazer",
        })),
      );
    }
    if (data.riscos.length) {
      await sb.from("risks").insert(
        data.riscos.map((r: any, i: number) => ({
          project_id: pid,
          ordem: i,
          risco_id: r.id ?? "",
          descricao: r.descricao ?? "",
          probabilidade: r.probabilidade ?? "Média",
          impacto: r.impacto ?? "Médio",
          mitigacao: r.mitigacao ?? "",
          responsavel: r.responsavel ?? "",
        })),
      );
    }
    if (data.userStories.length) {
      await sb.from("user_stories").insert(
        data.userStories.map((u: any) => ({
          project_id: pid,
          us_id: u.id ?? "",
          modulo: u.modulo ?? "",
          ator: u.ator ?? "",
          story: u.story ?? "",
          criterio1: u.criterio1 ?? "",
          criterio2: u.criterio2 ?? "",
          prioridade: u.prioridade ?? "Média",
          sprint: u.sprint ?? "",
          status: u.status ?? "A Documentar",
        })),
      );
    }
    if (data.casosTeste.length) {
      await sb.from("test_cases").insert(
        data.casosTeste.map((c: any) => ({
          project_id: pid,
          ct_id: c.id ?? "",
          id_us: c.idUs ?? "",
          modulo: c.modulo ?? "",
          tipo: c.tipo ?? "Funcional",
          precondicoes: c.precondicoes ?? "",
          massa: c.massa ?? "",
          passos: c.passos ?? "",
          esperado: c.esperado ?? "",
          obtido: c.obtido ?? "",
          status: (["Pendente", "Passou", "Falhou", "Bloqueado"].includes(c.status) ? c.status : "Pendente"),
          evidencia: c.evidencia ?? "",
          observacoes: c.observacoes ?? "",
        })),
      );
    }

    return { id: pid as string };
  });
