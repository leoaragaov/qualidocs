import ExcelJS from "exceljs";
import FileSaver from "file-saver";
const { saveAs } = FileSaver;
import type { CitseData } from "./citse-types";

type Fill = ExcelJS.FillPattern;

const TITLE_FILL: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1F2A44" } };
const SECTION_FILL: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF2E4172" } };
const HEADER_FILL: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE8EDF7" } };
const LABEL_FILL: Fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF4F6FB" } };

const thinBorder: Partial<ExcelJS.Borders> = {
  top: { style: "thin", color: { argb: "FFCBD2DC" } },
  left: { style: "thin", color: { argb: "FFCBD2DC" } },
  bottom: { style: "thin", color: { argb: "FFCBD2DC" } },
  right: { style: "thin", color: { argb: "FFCBD2DC" } },
};

function styleTitle(cell: ExcelJS.Cell) {
  cell.fill = TITLE_FILL;
  cell.font = { name: "Calibri", size: 16, bold: true, color: { argb: "FFFFFFFF" } };
  cell.alignment = { vertical: "middle", horizontal: "center" };
}
function styleSection(cell: ExcelJS.Cell) {
  cell.fill = SECTION_FILL;
  cell.font = { name: "Calibri", size: 12, bold: true, color: { argb: "FFFFFFFF" } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1 };
}
function styleHeader(cell: ExcelJS.Cell) {
  cell.fill = HEADER_FILL;
  cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1F2A44" } };
  cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
  cell.border = thinBorder;
}
function styleLabel(cell: ExcelJS.Cell) {
  cell.fill = LABEL_FILL;
  cell.font = { name: "Calibri", size: 11, bold: true, color: { argb: "FF1F2A44" } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  cell.border = thinBorder;
}
function styleValue(cell: ExcelJS.Cell) {
  cell.font = { name: "Calibri", size: 11, color: { argb: "FF1F2A44" } };
  cell.alignment = { vertical: "middle", horizontal: "left", indent: 1, wrapText: true };
  cell.border = thinBorder;
}

function addLabelRow(ws: ExcelJS.Worksheet, row: number, label: string, value: string) {
  ws.getCell(`A${row}`).value = label;
  styleLabel(ws.getCell(`A${row}`));
  ws.mergeCells(`A${row}:B${row}`);
  ws.getCell(`C${row}`).value = value;
  styleValue(ws.getCell(`C${row}`));
  ws.mergeCells(`C${row}:F${row}`);
  ws.getRow(row).height = Math.max(22, Math.min(120, 18 + (value.split("\n").length - 1) * 16));
}

function buildPlano(wb: ExcelJS.Workbook, data: CitseData) {
  const ws = wb.addWorksheet("Plano de Teste", { views: [{ showGridLines: false }] });
  ws.columns = [
    { width: 18 }, { width: 18 }, { width: 28 }, { width: 22 }, { width: 22 }, { width: 18 },
  ];

  ws.mergeCells("A1:F1");
  ws.getCell("A1").value = "📋  PLANO DE TESTE — PLATAFORMA QUALIDOCS";
  styleTitle(ws.getCell("A1"));
  ws.getRow(1).height = 34;

  // Section 1
  ws.mergeCells("A3:F3");
  ws.getCell("A3").value = "SEÇÃO 1 — IDENTIFICAÇÃO";
  styleSection(ws.getCell("A3"));
  ws.getRow(3).height = 24;

  const p = data.plano;
  addLabelRow(ws, 4, "Projeto", p.projeto);
  addLabelRow(ws, 5, "Versão do Plano", p.versao);
  addLabelRow(ws, 6, "Responsável QA", p.responsavel);
  addLabelRow(ws, 7, "Data de Criação", p.dataCriacao);
  addLabelRow(ws, 8, "Última Revisão", p.ultimaRevisao);
  addLabelRow(ws, 9, "Ambiente de Teste", p.ambiente);

  // Section 2
  ws.mergeCells("A11:F11");
  ws.getCell("A11").value = "SEÇÃO 2 — OBJETIVO";
  styleSection(ws.getCell("A11"));
  ws.getRow(11).height = 24;
  addLabelRow(ws, 12, "Objetivo Geral", p.objetivo);

  // Section 3
  ws.mergeCells("A14:F14");
  ws.getCell("A14").value = "SEÇÃO 3 — ESCOPO";
  styleSection(ws.getCell("A14"));
  ws.getRow(14).height = 24;
  addLabelRow(ws, 15, "IN SCOPE (Coberto)", p.inScope);
  addLabelRow(ws, 16, "OUT OF SCOPE (Excluído)", p.outOfScope);

  // Section 4 - Cronograma
  ws.mergeCells("A18:F18");
  ws.getCell("A18").value = "SEÇÃO 4 — CRONOGRAMA DE EXECUÇÃO";
  styleSection(ws.getCell("A18"));
  ws.getRow(18).height = 24;

  const cronHeaders = ["Fase", "Atividade", "Início", "Fim", "Responsável", "Status"];
  cronHeaders.forEach((h, i) => {
    const c = ws.getCell(19, i + 1);
    c.value = h;
    styleHeader(c);
  });
  ws.getRow(19).height = 24;
  p.cronograma.forEach((r, idx) => {
    const row = 20 + idx;
    const vals = [r.fase, r.atividade, r.inicio, r.fim, r.responsavel, r.status];
    vals.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      styleValue(c);
    });
    ws.getRow(row).height = 22;
  });

  // Section 5 - Riscos
  const riscoSectionRow = 21 + p.cronograma.length;
  ws.mergeCells(`A${riscoSectionRow}:F${riscoSectionRow}`);
  ws.getCell(`A${riscoSectionRow}`).value = "SEÇÃO 5 — GERENCIAMENTO DE RISCOS";
  styleSection(ws.getCell(`A${riscoSectionRow}`));
  ws.getRow(riscoSectionRow).height = 24;

  const riscoHeaderRow = riscoSectionRow + 1;
  const riscoHeaders = ["ID Risco", "Descrição do Risco", "Probabilidade", "Impacto", "Mitigação", "Responsável"];
  riscoHeaders.forEach((h, i) => {
    const c = ws.getCell(riscoHeaderRow, i + 1);
    c.value = h;
    styleHeader(c);
  });
  ws.getRow(riscoHeaderRow).height = 24;
  p.riscos.forEach((r, idx) => {
    const row = riscoHeaderRow + 1 + idx;
    const vals = [r.id, r.descricao, r.probabilidade, r.impacto, r.mitigacao, r.responsavel];
    vals.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      styleValue(c);
    });
    ws.getRow(row).height = Math.max(22, 18 + (r.mitigacao.split("\n").length - 1) * 16);
  });
}

function buildTable(
  wb: ExcelJS.Workbook,
  name: string,
  title: string,
  headers: { label: string; width: number }[],
  rows: string[][],
) {
  const ws = wb.addWorksheet(name, { views: [{ showGridLines: false, state: "frozen", ySplit: 3 }] });
  ws.columns = headers.map((h) => ({ width: h.width }));

  ws.mergeCells(1, 1, 1, headers.length);
  ws.getCell(1, 1).value = title;
  styleTitle(ws.getCell(1, 1));
  ws.getRow(1).height = 34;

  headers.forEach((h, i) => {
    const c = ws.getCell(3, i + 1);
    c.value = h.label;
    styleHeader(c);
  });
  ws.getRow(3).height = 30;

  rows.forEach((r, idx) => {
    const row = 4 + idx;
    let maxLines = 1;
    r.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      styleValue(c);
      const lines = (v || "").split("\n").length;
      if (lines > maxLines) maxLines = lines;
    });
    ws.getRow(row).height = Math.max(22, Math.min(220, 18 + (maxLines - 1) * 15));
  });

  return ws;
}

function buildMatriz(wb: ExcelJS.Workbook, data: CitseData) {
  const cts = data.casosTeste;
  const headers = [
    { label: "ID da História de Usuário (User Story ID)", width: 28 },
    { label: "Módulo (Module)", width: 24 },
    { label: "Descrição da História de Usuário (User Story)", width: 40 },
    ...cts.map((c) => ({ label: c.id, width: 16 })),
    { label: "Cobertura (Coverage %)", width: 18 },
  ];
  const ws = wb.addWorksheet("Matriz de Rastreabilidade", { views: [{ showGridLines: false }] });
  ws.columns = headers.map((h) => ({ width: h.width }));

  ws.mergeCells(1, 1, 1, headers.length);
  ws.getCell(1, 1).value = "🔗  MATRIZ DE RASTREABILIDADE — USER STORIES × CASOS DE TESTE";
  styleTitle(ws.getCell(1, 1));
  ws.getRow(1).height = 34;

  headers.forEach((h, i) => {
    const c = ws.getCell(3, i + 1);
    c.value = h.label;
    styleHeader(c);
  });
  ws.getRow(3).height = 28;

  data.userStories.forEach((us, idx) => {
    const row = 4 + idx;
    const linked = cts.map((ct) => ct.idUs.split(/[,;\s]+/).includes(us.id));
    const linkedCases = cts.filter((_, i) => linked[i]);
    const passedCount = linkedCases.filter((ct) => ct.status === "Passou").length;
    const linkedTotal = linkedCases.length;
    const pct = linkedTotal ? Math.round((passedCount / linkedTotal) * 100) : 0;

    const cellIcons = cts.map((ct, i) => {
      if (!linked[i]) return "";
      if (ct.status === "Passou") return "☑";
      if (ct.status === "Falhou") return "☒";
      if (ct.status === "Bloqueado") return "⛔";
      return "☐";
    });

    const desc = us.story.split("\n")[1]?.replace(/^Quero\s*/i, "") || us.story.split("\n")[0] || "";
    const pctText = linkedTotal ? `${pct}%` : "—";
    const base = [us.id, us.modulo, desc, ...cellIcons, pctText];
    base.forEach((v, i) => {
      const c = ws.getCell(row, i + 1);
      c.value = v;
      styleValue(c);
      if (i >= 3 && i < base.length - 1) c.alignment = { vertical: "middle", horizontal: "center" };
      if (i === base.length - 1) {
        c.alignment = { vertical: "middle", horizontal: "center" };
        const color = !linkedTotal ? "FF6B7280" : pct === 100 ? "FF0F7B3D" : pct > 0 ? "FFB45309" : "FFB42318";
        c.font = { name: "Calibri", size: 11, bold: true, color: { argb: color } };
      }
    });
    ws.getRow(row).height = 24;
  });
}

export async function exportCitseToXlsx(data: CitseData) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QualiDocs Framework";
  wb.created = new Date();

  buildPlano(wb, data);

  buildTable(
    wb,
    "Histórias de Usuário",
    "📖  HISTÓRIAS DE USUÁRIO (USER STORIES)",
    [
      { label: "ID_US", width: 14 },
      { label: "Módulo", width: 22 },
      { label: "Ator / Perfil", width: 22 },
      { label: "User Story (Eu como… Quero… Para que…)", width: 42 },
      { label: "Critério de Aceitação 1", width: 42 },
      { label: "Critério de Aceitação 2", width: 42 },
      { label: "Prioridade", width: 12 },
      { label: "Sprint / Release", width: 14 },
      { label: "Status", width: 14 },
    ],
    data.userStories.map((u) => [u.id, u.modulo, u.ator, u.story, u.criterio1, u.criterio2, u.prioridade, u.sprint, u.status]),
  );

  buildTable(
    wb,
    "Casos de Teste Detalhados",
    "🧪  CASOS DE TESTE DETALHADOS",
    [
      { label: "ID_CT", width: 14 },
      { label: "ID_US (Rastr.)", width: 16 },
      { label: "Módulo", width: 22 },
      { label: "Tipo de Teste", width: 14 },
      { label: "Pré-condições", width: 34 },
      { label: "Massa de Dados (Entrada)", width: 30 },
      { label: "Passo a Passo (Ação do Usuário)", width: 36 },
      { label: "Resultado Esperado", width: 36 },
      { label: "Resultado Obtido", width: 30 },
      { label: "Status", width: 16 },
      { label: "Evidência (Link/Print)", width: 22 },
      { label: "Observações", width: 28 },
    ],
    data.casosTeste.map((c) => [
      c.id, c.idUs, c.modulo, c.tipo, c.precondicoes, c.massa, c.passos, c.esperado, c.obtido, c.status, c.evidencia, c.observacoes,
    ]),
  );

  buildMatriz(wb, data);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const stamp = new Date().toISOString().slice(0, 10);
  saveAs(blob, `QualiDocs_Framework_QA_${stamp}.xlsx`);
}

// ============ TMS export (banco de dados) ============
import type { TmsProjectDetail } from "./tms-types";

function buildPlanoDB(wb: ExcelJS.Workbook, d: TmsProjectDetail) {
  const p = d.project;
  const adapter: CitseData = {
    plano: {
      projeto: p.projeto, versao: p.versao, responsavel: p.responsavel,
      dataCriacao: p.data_criacao ?? "", ultimaRevisao: p.ultima_revisao ?? "",
      ambiente: p.ambiente, objetivo: p.objetivo, inScope: p.in_scope, outOfScope: p.out_of_scope,
      cronograma: d.schedule.map((s) => ({
        fase: s.fase, atividade: s.atividade, inicio: s.inicio ?? "", fim: s.fim ?? "",
        responsavel: s.responsavel, status: s.status,
      })),
      riscos: d.risks.map((r) => ({
        id: r.risco_id, descricao: r.descricao, probabilidade: r.probabilidade,
        impacto: r.impacto, mitigacao: r.mitigacao, responsavel: r.responsavel,
      })),
    },
    userStories: d.userStories.map((u) => ({
      id: u.us_id, modulo: u.modulo, ator: u.ator, story: u.story,
      criterio1: u.criterio1, criterio2: u.criterio2, prioridade: u.prioridade,
      sprint: u.sprint, status: u.status,
    })),
    casosTeste: d.testCases.map((c) => ({
      id: c.ct_id, idUs: c.id_us, modulo: c.modulo, tipo: c.tipo,
      precondicoes: c.precondicoes, massa: c.massa, passos: c.passos,
      esperado: c.esperado, obtido: c.obtido, status: c.status,
      evidencia: c.evidencia, observacoes: c.observacoes,
    })),
  };
  buildPlano(wb, adapter);
  return adapter;
}

function buildBugsSheet(wb: ExcelJS.Workbook, d: TmsProjectDetail) {
  const ctMap = Object.fromEntries(d.testCases.map((c) => [c.id, c.ct_id]));
  buildTable(
    wb, "Relatório de Bugs", "🐞  RELATÓRIO DE BUGS",
    [
      { label: "ID_Bug", width: 14 },
      { label: "CT Relacionado", width: 16 },
      { label: "Título", width: 34 },
      { label: "Severidade", width: 12 },
      { label: "Comportamento Atual", width: 36 },
      { label: "Comportamento Esperado", width: 36 },
      { label: "Status", width: 16 },
      { label: "Registrado em", width: 18 },
    ],
    d.bugs.map((b) => [
      b.bug_id, b.test_case_id ? (ctMap[b.test_case_id] ?? "") : "",
      b.titulo, b.severidade, b.comportamento_atual, b.comportamento_esperado,
      b.status, new Date(b.created_at).toLocaleString(),
    ]),
  );
}

function buildDashboardSheet(wb: ExcelJS.Workbook, d: TmsProjectDetail) {
  const total = d.testCases.length;
  const count = (s: string) => d.testCases.filter((c) => c.status === s).length;
  const passou = count("Passou"), falhou = count("Falhou"), bloq = count("Bloqueado"), pend = count("Pendente");
  const pctS = total ? Math.round((passou / total) * 100) : 0;
  const pctF = total ? Math.round((falhou / total) * 100) : 0;
  const abertos = d.bugs.filter((b) => b.status === "Aberto" || b.status === "Em Correção").length;
  const corrigidos = d.bugs.filter((b) => b.status === "Corrigido" || b.status === "Retestado").length;

  buildTable(
    wb, "Dashboard de Fechamento", "📊  DASHBOARD DE FECHAMENTO",
    [{ label: "Métrica", width: 34 }, { label: "Valor", width: 20 }],
    [
      ["Total de Casos de Teste", String(total)],
      ["Passou", String(passou)],
      ["Falhou", String(falhou)],
      ["Bloqueado", String(bloq)],
      ["Pendente", String(pend)],
      ["% Sucesso", `${pctS}%`],
      ["% Falha", `${pctF}%`],
      ["Total de Bugs", String(d.bugs.length)],
      ["Bugs Abertos / Em Correção", String(abertos)],
      ["Bugs Corrigidos / Retestados", String(corrigidos)],
    ],
  );
}

export async function exportProjectToXlsx(d: TmsProjectDetail) {
  const wb = new ExcelJS.Workbook();
  wb.creator = "QualiDocs Framework";
  wb.created = new Date();

  const adapter = buildPlanoDB(wb, d);
  buildTable(
    wb, "Histórias de Usuário", "📖  HISTÓRIAS DE USUÁRIO",
    [
      { label: "ID_US", width: 14 }, { label: "Módulo", width: 22 },
      { label: "Ator", width: 22 }, { label: "User Story", width: 42 },
      { label: "Critério 1", width: 42 }, { label: "Critério 2", width: 42 },
      { label: "Prioridade", width: 12 }, { label: "Sprint", width: 14 }, { label: "Status", width: 14 },
    ],
    adapter.userStories.map((u) => [u.id, u.modulo, u.ator, u.story, u.criterio1, u.criterio2, u.prioridade, u.sprint, u.status]),
  );
  buildTable(
    wb, "Casos de Teste", "🧪  CASOS DE TESTE",
    [
      { label: "ID_CT", width: 14 }, { label: "ID_US", width: 16 }, { label: "Módulo", width: 22 },
      { label: "Tipo", width: 14 }, { label: "Pré-condições", width: 34 }, { label: "Massa", width: 30 },
      { label: "Passos", width: 36 }, { label: "Esperado", width: 36 }, { label: "Obtido", width: 30 },
      { label: "Status", width: 14 }, { label: "Evidência", width: 22 }, { label: "Observações", width: 28 },
    ],
    adapter.casosTeste.map((c) => [c.id, c.idUs, c.modulo, c.tipo, c.precondicoes, c.massa, c.passos, c.esperado, c.obtido, c.status, c.evidencia, c.observacoes]),
  );
  buildMatriz(wb, adapter);
  buildBugsSheet(wb, d);
  buildDashboardSheet(wb, d);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const stamp = new Date().toISOString().slice(0, 10);
  const name = (d.project.projeto || "projeto")
    .replace(/[^\w\s-]+/g, "")
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");

  saveAs(blob, `QualiDocs_Framework_QA_${name}_${stamp}.xlsx`);
}
