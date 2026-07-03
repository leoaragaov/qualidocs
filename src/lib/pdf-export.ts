import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import type { TmsProjectDetail } from "./tms-types";

const NAVY: [number, number, number] = [31, 42, 68];
const NAVY_SOFT: [number, number, number] = [46, 65, 114];
const GREEN: [number, number, number] = [15, 123, 61];
const RED: [number, number, number] = [180, 35, 24];
const GRAY_TEXT: [number, number, number] = [70, 78, 95];
const LIGHT: [number, number, number] = [244, 246, 251];

function fmtDate(d?: string | null) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString("pt-BR");
}

function drawHeaderBar(doc: jsPDF, title: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY);
  doc.rect(0, 0, w, 18, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text(title, 14, 12);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Relatório Executivo de QA", w - 14, 12, { align: "right" });
}

function drawFooters(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setDrawColor(220, 224, 232);
    doc.line(14, h - 12, w - 14, h - 12);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(...GRAY_TEXT);
    doc.text("Citse QA Framework", 14, h - 6);
    doc.text(`Página ${i} de ${pageCount}`, w - 14, h - 6, { align: "right" });
  }
}

function sectionTitle(doc: jsPDF, y: number, label: string) {
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(...NAVY_SOFT);
  doc.rect(14, y, w - 28, 8, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text(label, 18, y + 5.6);
  return y + 12;
}

export async function exportProjectToPdf(d: TmsProjectDetail) {
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();

  const p = d.project;
  const tests = d.testCases;
  const total = tests.length;
  const passou = tests.filter((t) => t.status === "Passou").length;
  const falhou = tests.filter((t) => t.status === "Falhou").length;
  const bloq = tests.filter((t) => t.status === "Bloqueado").length;
  const pend = tests.filter((t) => t.status === "Pendente").length;
  const pctS = total ? Math.round((passou / total) * 100) : 0;
  const pctF = total ? Math.round((falhou / total) * 100) : 0;
  const bugsAbertos = d.bugs.filter((b) => b.status === "Aberto" || b.status === "Em Correção").length;

  // ============ CAPA ============
  drawHeaderBar(doc, p.projeto || "Projeto sem nome");

  // Big project title block
  doc.setTextColor(...NAVY);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(22);
  doc.text("Relatório Executivo de QA", 14, 40);
  doc.setDrawColor(...NAVY);
  doc.setLineWidth(0.8);
  doc.line(14, 44, 80, 44);

  doc.setFontSize(14);
  doc.setTextColor(...NAVY_SOFT);
  doc.text(p.projeto || "(sem nome)", 14, 56);

  // Identification card
  let y = 68;
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 3, textColor: NAVY as unknown as number[] },
    columnStyles: {
      0: { fillColor: LIGHT as unknown as number[], fontStyle: "bold", cellWidth: 55 },
      1: { cellWidth: "auto" },
    },
    body: [
      ["Projeto", p.projeto || "—"],
      ["Versão", p.versao || "—"],
      ["Responsável QA", p.responsavel || "—"],
      ["Ambiente", p.ambiente || "—"],
      ["Data de Criação", fmtDate(p.data_criacao)],
      ["Última Revisão", fmtDate(p.ultima_revisao)],
      ["Data de Geração", new Date().toLocaleString("pt-BR")],
    ],
    margin: { left: 14, right: 14 },
  });

  // Status da Release badge
  const criticosOk = total > 0 && falhou === 0 && bloq === 0;
  const approved = criticosOk && bugsAbertos === 0 && pctS === 100;
  const statusLabel = approved ? "APROVADO" : "EM ATENÇÃO";
  const statusColor: [number, number, number] = approved ? GREEN : RED;

  const afterY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  doc.setFillColor(...statusColor);
  doc.roundedRect(14, afterY, w - 28, 20, 3, 3, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.text("STATUS DA RELEASE", 20, afterY + 8);
  doc.setFontSize(18);
  doc.text(statusLabel, w - 20, afterY + 13, { align: "right" });

  doc.setTextColor(...GRAY_TEXT);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  const motivo = approved
    ? "100% dos casos de teste passaram e não há bugs pendentes."
    : `Sucesso ${pctS}% · Falhas ${falhou} · Bloqueados ${bloq} · Bugs abertos ${bugsAbertos}.`;
  doc.text(motivo, 14, afterY + 28);

  // ============ SEÇÃO 2: RESUMO MÉTRICO ============
  doc.addPage();
  drawHeaderBar(doc, p.projeto || "Projeto");
  y = 28;
  y = sectionTitle(doc, y, "SEÇÃO 2 — RESUMO MÉTRICO");
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: NAVY as unknown as number[], textColor: 255, fontStyle: "bold" },
    head: [["Métrica", "Valor"]],
    body: [
      ["Total de Histórias de Usuário", String(d.userStories.length)],
      ["Total de Casos de Teste", String(total)],
      ["Casos que Passaram", `${passou} (${pctS}%)`],
      ["Casos com Falha", `${falhou} (${pctF}%)`],
      ["Casos Bloqueados", String(bloq)],
      ["Casos Pendentes", String(pend)],
      ["Total de Bugs Encontrados", String(d.bugs.length)],
      ["Bugs Abertos / Em Correção", String(bugsAbertos)],
    ],
    margin: { left: 14, right: 14 },
  });

  // ============ SEÇÃO 3: ESCOPO & CRONOGRAMA ============
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 8;
  y = sectionTitle(doc, y, "SEÇÃO 3 — ESCOPO & CRONOGRAMA");
  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 9, cellPadding: 3, textColor: NAVY as unknown as number[] },
    columnStyles: {
      0: { fillColor: LIGHT as unknown as number[], fontStyle: "bold", cellWidth: 40 },
    },
    body: [
      ["Objetivo", p.objetivo || "—"],
      ["Em Escopo", p.in_scope || "—"],
      ["Fora de Escopo", p.out_of_scope || "—"],
    ],
    margin: { left: 14, right: 14 },
  });

  if (d.schedule.length) {
    y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 4;
    autoTable(doc, {
      startY: y,
      theme: "striped",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5 },
      headStyles: { fillColor: NAVY_SOFT as unknown as number[], textColor: 255 },
      head: [["Fase", "Atividade", "Início", "Fim", "Responsável", "Status"]],
      body: d.schedule.map((s) => [s.fase, s.atividade, fmtDate(s.inicio), fmtDate(s.fim), s.responsavel, s.status]),
      margin: { left: 14, right: 14 },
    });
  }

  // ============ SEÇÃO 4: DETALHAMENTO DE EXECUÇÃO ============
  doc.addPage();
  drawHeaderBar(doc, p.projeto || "Projeto");
  y = 28;
  y = sectionTitle(doc, y, "SEÇÃO 4 — DETALHAMENTO DE EXECUÇÃO");

  autoTable(doc, {
    startY: y,
    theme: "grid",
    styles: { font: "helvetica", fontSize: 8.5, cellPadding: 2.5, valign: "top" },
    headStyles: { fillColor: NAVY as unknown as number[], textColor: 255 },
    head: [["ID_CT", "Módulo", "Caso de Teste", "Resultado Obtido", "Status"]],
    body: tests.map((c) => [c.ct_id, c.modulo, c.esperado || c.passos || "—", c.obtido || "—", c.status]),
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 28 },
      4: { cellWidth: 24, halign: "center", fontStyle: "bold" },
    },
    margin: { left: 14, right: 14 },
    didParseCell: (data) => {
      if (data.section === "body" && data.column.index === 4) {
        const v = String(data.cell.raw ?? "");
        if (v === "Passou") data.cell.styles.textColor = GREEN as unknown as number[];
        else if (v === "Falhou") data.cell.styles.textColor = RED as unknown as number[];
        else data.cell.styles.textColor = GRAY_TEXT as unknown as number[];
      }
    },
  });

  // ============ SEÇÃO 5: RELATÓRIO DE DEFEITOS ============
  const hasFailed = tests.some((t) => t.status === "Falhou");
  y = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10;
  if (y > h - 40) { doc.addPage(); drawHeaderBar(doc, p.projeto || "Projeto"); y = 28; }
  y = sectionTitle(doc, y, "SEÇÃO 5 — RELATÓRIO DE DEFEITOS (BUGS)");

  if (d.bugs.length === 0) {
    doc.setFont("helvetica", "italic");
    doc.setFontSize(10);
    doc.setTextColor(...GRAY_TEXT);
    doc.text(
      hasFailed
        ? "Existem falhas registradas, mas nenhum bug foi cadastrado nesta rodada de testes."
        : "Nenhum defeito encontrado nesta rodada de testes.",
      14,
      y + 2,
    );
  } else {
    autoTable(doc, {
      startY: y,
      theme: "grid",
      styles: { font: "helvetica", fontSize: 9, cellPadding: 2.5, valign: "top" },
      headStyles: { fillColor: NAVY as unknown as number[], textColor: 255 },
      head: [["ID_Bug", "Título / Descrição", "Severidade", "Status"]],
      body: d.bugs.map((b) => [b.bug_id, b.titulo, b.severidade, b.status]),
      columnStyles: {
        0: { cellWidth: 22 },
        2: { cellWidth: 26, halign: "center" },
        3: { cellWidth: 30, halign: "center", fontStyle: "bold" },
      },
      margin: { left: 14, right: 14 },
      didParseCell: (data) => {
        if (data.section === "body" && data.column.index === 3) {
          const v = String(data.cell.raw ?? "");
          if (v === "Corrigido" || v === "Retestado") data.cell.styles.textColor = GREEN as unknown as number[];
          else if (v === "Aberto" || v === "Em Correção") data.cell.styles.textColor = RED as unknown as number[];
        }
        if (data.section === "body" && data.column.index === 2) {
          const v = String(data.cell.raw ?? "");
          if (v === "Alta") data.cell.styles.textColor = RED as unknown as number[];
        }
      },
    });
  }

  drawFooters(doc);

  const safeName = (p.projeto || "projeto").replace(/[^\w\-]+/g, "_");
  const stamp = new Date().toISOString().slice(0, 10);
  doc.save(`Relatorio_QA_${safeName}_${stamp}.pdf`);
}
