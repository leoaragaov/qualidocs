// Reactive derivation of User Story and Schedule statuses from test-case execution.
import type { TmsBug, TmsSchedule, TmsTestCase, TmsUserStory } from "./tms-types";

export type DerivedUsStatus = "A Documentar" | "Em Teste" | "Validada" | "Bloqueada";

export const US_STATUSES: DerivedUsStatus[] = ["A Documentar", "Em Teste", "Validada", "Bloqueada"];

/** Test cases whose id_us field references the given us_id (split by , ; or whitespace). */
export function linkedTestCases(us: TmsUserStory, cases: TmsTestCase[]): TmsTestCase[] {
  const usId = (us?.us_id ?? "").trim();
  if (!usId) return [];
  return cases.filter((ct) =>
    (ct?.id_us ?? "")
      .split(/[,;\s]+/)
      .map((s) => s.trim())
      .filter(Boolean)
      .includes(usId),
  );
}

export function deriveUsStatus(us: TmsUserStory, cases: TmsTestCase[]): DerivedUsStatus {
  const linked = linkedTestCases(us, cases);
  if (linked.length === 0) return "A Documentar";
  const allPending = linked.every((c) => !c.status || c.status === "Pendente");
  if (allPending) return "A Documentar";
  const hasBadOutcome = linked.some((c) => c.status === "Falhou" || c.status === "Bloqueado");
  if (hasBadOutcome) return "Bloqueada";
  const allPassed = linked.every((c) => c.status === "Passou");
  if (allPassed) return "Validada";
  return "Em Teste";
}

const PLAN_ACTIVITY = /(elaborar\s+(o\s+)?plano|planejamento|planejar)/i;
const EXEC_ACTIVITY = /(executar\s+(o\s+)?plano|execu[cç][aã]o)/i;
const REPORT_ACTIVITY = /(reportar\s+bugs|montar\s+relat[óo]rio|relat[óo]rio(\s+de\s+resultados)?)/i;

export type ScheduleStatus = "A Fazer" | "Em Andamento" | "Concluído";

type Phase = "plan" | "exec" | "report" | null;

function phaseOf(label: string): Phase {
  if (PLAN_ACTIVITY.test(label)) return "plan";
  if (EXEC_ACTIVITY.test(label)) return "exec";
  if (REPORT_ACTIVITY.test(label)) return "report";
  return null;
}

/**
 * Compute the automated status for every schedule row, applying the cascade:
 * plan → exec → report. Rows whose activity name doesn't match any phase are
 * left untouched (returns null for that index).
 */
export function deriveScheduleStatuses(
  rows: TmsSchedule[],
  cases: TmsTestCase[],
  bugs: TmsBug[],
): (ScheduleStatus | null)[] {
  const total = cases.length;
  const executed = cases.filter((c) => c.status && c.status !== "Pendente").length;
  const openBugs = bugs.filter((b) => b.status === "Aberto" || b.status === "Em Correção").length;

  // First pass — independent computation
  const execStatus: ScheduleStatus =
    total === 0
      ? "A Fazer"
      : executed === 0
        ? "Em Andamento" // planejamento concluded (see below) → execução parte de "Em Andamento"
        : executed >= total
          ? "Concluído"
          : "Em Andamento";

  const reportStatus: ScheduleStatus =
    execStatus === "Concluído"
      ? openBugs > 0
        ? "Em Andamento"
        : "Concluído"
      : "A Fazer";

  // Plano: concluído se existir CT cadastrado, ou se execução/relatório já avançaram
  const planStatus: ScheduleStatus =
    total > 0 || execStatus !== "A Fazer" || reportStatus === "Concluído"
      ? "Concluído"
      : "A Fazer";

  // Segunda passada: se planejamento está concluído mas nenhum teste foi executado,
  // execução vai para "Em Andamento" (já é o default acima quando total===0? não —
  // total===0 mantém "A Fazer"). Ajuste:
  const finalExec: ScheduleStatus =
    planStatus === "Concluído" && total === 0
      ? "Em Andamento"
      : execStatus;

  return rows.map((r) => {
    switch (phaseOf((r?.atividade ?? "").toString())) {
      case "plan":
        return planStatus;
      case "exec":
        return finalExec;
      case "report":
        return reportStatus;
      default:
        return null;
    }
  });
}

/** Backwards-compatible single-row helper. */
export function deriveScheduleStatus(
  row: TmsSchedule,
  cases: TmsTestCase[],
  bugs: TmsBug[],
): ScheduleStatus | null {
  return deriveScheduleStatuses([row], cases, bugs)[0];
}

export function usBadgeClass(s: DerivedUsStatus): string {
  switch (s) {
    case "Validada":
      return "bg-green-100 text-green-800 border-green-200";
    case "Em Teste":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "Bloqueada":
      return "bg-red-100 text-red-800 border-red-200";
    case "A Documentar":
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}

export function scheduleBadgeClass(s: string): string {
  switch (s) {
    case "Concluído":
      return "bg-green-100 text-green-800 border-green-200";
    case "Em Andamento":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "A Fazer":
    default:
      return "bg-slate-100 text-slate-700 border-slate-200";
  }
}
