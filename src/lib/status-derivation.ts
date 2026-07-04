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

const EXEC_ACTIVITY = /executar\s+(o\s+)?plano/i;
const REPORT_ACTIVITY = /(reportar\s+bugs|montar\s+relat[óo]rio|relat[óo]rio\s+de\s+resultados)/i;

export type ScheduleStatus = "A Fazer" | "Em Andamento" | "Concluído";

export function deriveScheduleStatus(
  row: TmsSchedule,
  cases: TmsTestCase[],
  bugs: TmsBug[],
): ScheduleStatus | null {
  const label = (row?.atividade ?? "").toString();
  const total = cases.length;
  const executed = cases.filter((c) => c.status && c.status !== "Pendente").length;

  if (EXEC_ACTIVITY.test(label)) {
    if (total === 0) return null;
    if (executed === 0) return "A Fazer";
    if (executed >= total) return "Concluído";
    return "Em Andamento";
  }
  if (REPORT_ACTIVITY.test(label)) {
    if (total === 0 || executed < total) return null; // wait for execution to finish
    const openBugs = bugs.filter((b) => b.status === "Aberto" || b.status === "Em Correção").length;
    return openBugs > 0 ? "Em Andamento" : "Concluído";
  }
  return null;
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
