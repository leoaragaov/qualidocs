import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  ArrowLeft, Download, Plus, Trash2, Save, FileSpreadsheet, Bug as BugIcon, History, LogOut,
  CheckCircle2, XCircle, ShieldAlert, Circle, Users, Copy, Send, RefreshCw, Crown, Clock,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import {
  getProjectDetail, updateProject, upsertSchedule, upsertRisk, upsertUserStory,
  upsertTestCase, setTestCaseStatus, executeTestCase, upsertBug, deleteRow, listAudit,
} from "@/lib/tms.functions";
import {
  listMembers, listInvitations, inviteMember, updateMemberRole, removeMember,
  revokeInvitation, resendInvitation, listAccessRequests, decideAccessRequest,
  getProjectPreview, requestProjectAccess, type ProjectRole,
} from "@/lib/members.functions";
import type {
  TmsSchedule, TmsRisk, TmsUserStory, TmsTestCase, TmsBug, TestStatus, BugSeverity, BugStatus,
} from "@/lib/tms-types";


const projectDetailQueryOptions = (id: string) => ({
  queryKey: ["project", id] as const,
  queryFn: () => getProjectDetail({ data: { id } }),
  staleTime: 15_000,
});

export const Route = createFileRoute("/_authenticated/projects/$id")({
  head: () => ({ meta: [{ title: "Projeto · Citse QA" }] }),
  loader: ({ context, params }) =>
    context.queryClient.ensureQueryData(projectDetailQueryOptions(params.id)),
  component: ProjectPage,
});

type Tab = "plano" | "us" | "ct" | "exec" | "bugs" | "audit" | "matriz" | "membros";

function ProjectPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<Tab>("plano");

  const { data, isPending, error } = useQuery(projectDetailQueryOptions(id));

  const invalidate = () => qc.invalidateQueries({ queryKey: ["project", id] });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  async function handleExport() {
    if (!data) return;
    try {
      setExporting(true);
      const { exportProjectToXlsx } = await import("@/lib/citse-export");
      await exportProjectToXlsx(data);
      toast.success("Planilha gerada!");
    } catch (e) {
      console.error(e);
      toast.error("Falha ao exportar planilha.");
    } finally {
      setExporting(false);
    }
  }

  if (isPending) return <div className="p-8 text-sm text-muted-foreground">Carregando projeto…</div>;
  if (error || !data) return <RequestAccessScreen projectId={id} onSignOut={signOut} />;

  const code = data.project.codigo_acesso || "";
  async function copyCode() {
    if (!code) return;
    try { await navigator.clipboard.writeText(code); toast.success("Código copiado"); }
    catch { toast.error("Falha ao copiar"); }
  }

  return (
    <div className="min-h-screen bg-slate-50/60">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-6 py-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Projetos</Link>
            </Button>
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
                <FileSpreadsheet className="h-4 w-4" />
              </div>
              <div>
                <h1 className="text-base font-semibold leading-tight">{data.project.projeto || "(sem nome)"}</h1>
                <p className="text-xs text-muted-foreground">v{data.project.versao || "—"}</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {code && (
              <button
                onClick={copyCode}
                title="Copiar código de acesso"
                className="group inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono tracking-wider text-slate-700 shadow-sm transition-colors hover:border-primary/40 hover:bg-primary/5 hover:text-primary"
              >
                <Copy className="h-3.5 w-3.5 opacity-60 group-hover:opacity-100" />
                {code}
              </button>
            )}
            <Button onClick={handleExport} disabled={exporting}>
              <Download className="mr-2 h-4 w-4" /> {exporting ? "Gerando..." : "Exportar XLSX"}
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
          <div className="mb-6 overflow-x-auto">
            <TabsList className="inline-flex h-11 items-center gap-1 rounded-full border border-slate-200/70 bg-white/80 p-1 shadow-sm backdrop-blur">
              <TabsTrigger value="plano" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Plano</TabsTrigger>
              <TabsTrigger value="us" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">US <Badge variant="secondary" className="ml-2">{data.userStories.length}</Badge></TabsTrigger>
              <TabsTrigger value="ct" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">CT <Badge variant="secondary" className="ml-2">{data.testCases.length}</Badge></TabsTrigger>
              <TabsTrigger value="exec" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Execução</TabsTrigger>
              <TabsTrigger value="bugs" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Bugs <Badge variant="secondary" className="ml-2">{data.bugs.length}</Badge></TabsTrigger>
              <TabsTrigger value="audit" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Auditoria</TabsTrigger>
              <TabsTrigger value="matriz" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">Matriz</TabsTrigger>
              <TabsTrigger value="membros" className="rounded-full px-4 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"><Users className="mr-1 h-3.5 w-3.5" />Membros</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="plano"><PlanoTab project={data.project} schedule={data.schedule} risks={data.risks} onChange={invalidate} /></TabsContent>
          <TabsContent value="us"><UserStoriesTab projectId={id} rows={data.userStories} onChange={invalidate} /></TabsContent>
          <TabsContent value="ct"><TestCasesTab projectId={id} rows={data.testCases} onChange={invalidate} /></TabsContent>
          <TabsContent value="exec"><ExecutionTab projectId={id} rows={data.testCases} onChange={invalidate} /></TabsContent>
          <TabsContent value="bugs"><BugsTab projectId={id} rows={data.bugs} testCases={data.testCases} onChange={invalidate} /></TabsContent>
          <TabsContent value="audit"><AuditTab projectId={id} /></TabsContent>
          <TabsContent value="matriz"><MatrizTab userStories={data.userStories} testCases={data.testCases} /></TabsContent>
          <TabsContent value="membros"><MembersTab projectId={id} /></TabsContent>
        </Tabs>

      </main>
    </div>
  );
}

// ============ Reusable field ============
function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

// ============ Plano tab ============
function PlanoTab({ project, schedule, risks, onChange }: {
  project: any; schedule: TmsSchedule[]; risks: TmsRisk[]; onChange: () => void;
}) {
  const upd = useServerFn(updateProject);
  const upSched = useServerFn(upsertSchedule);
  const upRisk = useServerFn(upsertRisk);
  const del = useServerFn(deleteRow);

  const [p, setP] = useState(project);
  useEffect(() => setP(project), [project]);

  const saveM = useMutation({
    mutationFn: () => upd({ data: {
      id: p.id, projeto: p.projeto, versao: p.versao, responsavel: p.responsavel, ambiente: p.ambiente,
      data_criacao: p.data_criacao || null, ultima_revisao: p.ultima_revisao || null,
      objetivo: p.objetivo, in_scope: p.in_scope, out_of_scope: p.out_of_scope,
    } }),
    onSuccess: () => { toast.success("Plano salvo"); onChange(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      {project.codigo_acesso && (
        <Card className="rounded-xl border-primary/20 bg-gradient-to-br from-primary/5 to-transparent shadow-sm">
          <CardContent className="flex flex-wrap items-center justify-between gap-4 py-5">
            <div>
              <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Código de acesso do projeto</p>
              <p className="mt-1 font-mono text-2xl font-semibold tracking-widest text-primary">{project.codigo_acesso}</p>
              <p className="mt-1 text-xs text-muted-foreground">Compartilhe com quem deve colaborar neste projeto.</p>
            </div>
            <Button
              variant="outline"
              onClick={async () => {
                try { await navigator.clipboard.writeText(project.codigo_acesso); toast.success("Código copiado"); }
                catch { toast.error("Falha ao copiar"); }
              }}
            >
              <Copy className="mr-2 h-4 w-4" /> Copiar código
            </Button>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Identificação</CardTitle>
          <Button size="sm" onClick={() => saveM.mutate()} disabled={saveM.isPending}>
            <Save className="mr-2 h-4 w-4" /> Salvar plano
          </Button>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <Field label="Projeto"><Input value={p.projeto} onChange={(e) => setP({ ...p, projeto: e.target.value })} /></Field>
          <Field label="Versão do Plano"><Input value={p.versao} onChange={(e) => setP({ ...p, versao: e.target.value })} /></Field>
          <Field label="Responsável QA"><Input value={p.responsavel} onChange={(e) => setP({ ...p, responsavel: e.target.value })} /></Field>
          <Field label="Ambiente de Teste"><Input value={p.ambiente} onChange={(e) => setP({ ...p, ambiente: e.target.value })} /></Field>
          <Field label="Data de Criação"><Input type="date" value={p.data_criacao ?? ""} onChange={(e) => setP({ ...p, data_criacao: e.target.value })} /></Field>
          <Field label="Última Revisão"><Input type="date" value={p.ultima_revisao ?? ""} onChange={(e) => setP({ ...p, ultima_revisao: e.target.value })} /></Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Objetivo & Escopo</CardTitle></CardHeader>
        <CardContent className="grid gap-4">
          <Field label="Objetivo Geral"><Textarea rows={3} value={p.objetivo} onChange={(e) => setP({ ...p, objetivo: e.target.value })} /></Field>
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="IN SCOPE (uma linha por item)"><Textarea rows={5} value={p.in_scope} onChange={(e) => setP({ ...p, in_scope: e.target.value })} /></Field>
            <Field label="OUT OF SCOPE (uma linha por item)"><Textarea rows={5} value={p.out_of_scope} onChange={(e) => setP({ ...p, out_of_scope: e.target.value })} /></Field>
          </div>
        </CardContent>
      </Card>

      <RowEditor
        title="Cronograma"
        rows={schedule}
        newRow={() => ({ project_id: p.id, ordem: schedule.length, fase: "", atividade: "", inicio: null, fim: null, responsavel: "", status: "A Fazer" }) as TmsSchedule}
        onSave={async (r) => { await upSched({ data: r as any }); onChange(); }}
        onDelete={async (rid) => { await del({ data: { table: "schedule_items", id: rid } }); onChange(); }}
        render={(r, upd) => (
          <div className="grid gap-2 md:grid-cols-6">
            <Input placeholder="Fase" value={r.fase} onChange={(e) => upd({ ...r, fase: e.target.value })} />
            <Input placeholder="Atividade" value={r.atividade} onChange={(e) => upd({ ...r, atividade: e.target.value })} className="md:col-span-2" />
            <Input type="date" value={r.inicio ?? ""} onChange={(e) => upd({ ...r, inicio: e.target.value || null })} />
            <Input type="date" value={r.fim ?? ""} onChange={(e) => upd({ ...r, fim: e.target.value || null })} />
            <Input placeholder="Responsável" value={r.responsavel} onChange={(e) => upd({ ...r, responsavel: e.target.value })} />
          </div>
        )}
      />

      <RowEditor
        title="Riscos"
        rows={risks}
        newRow={() => ({ project_id: p.id, ordem: risks.length, risco_id: "", descricao: "", probabilidade: "Média", impacto: "Médio", mitigacao: "", responsavel: "" }) as TmsRisk}
        onSave={async (r) => { await upRisk({ data: r as any }); onChange(); }}
        onDelete={async (rid) => { await del({ data: { table: "risks", id: rid } }); onChange(); }}
        render={(r, upd) => (
          <div className="grid gap-2 md:grid-cols-6">
            <Input placeholder="ID" value={r.risco_id} onChange={(e) => upd({ ...r, risco_id: e.target.value })} />
            <Textarea placeholder="Descrição" rows={2} value={r.descricao} onChange={(e) => upd({ ...r, descricao: e.target.value })} className="md:col-span-2" />
            <Select value={r.probabilidade} onValueChange={(v) => upd({ ...r, probabilidade: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Alta", "Média", "Baixa"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={r.impacto} onValueChange={(v) => upd({ ...r, impacto: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{["Alto", "Medio", "Baixo"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
            <Input placeholder="Responsável" value={r.responsavel} onChange={(e) => upd({ ...r, responsavel: e.target.value })} />
            <Textarea placeholder="Mitigação" rows={2} value={r.mitigacao} onChange={(e) => upd({ ...r, mitigacao: e.target.value })} className="md:col-span-6" />
          </div>
        )}
      />
    </div>
  );
}

// Reusable inline row editor with local state per row
function RowEditor<T extends { id?: string }>({ title, rows, newRow, onSave, onDelete, render }: {
  title: string;
  rows: T[];
  newRow: () => T;
  onSave: (r: T) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  render: (r: T, upd: (r: T) => void) => React.ReactNode;
}) {
  const [drafts, setDrafts] = useState<Record<string, T>>({});
  const [newDraft, setNewDraft] = useState<T | null>(null);

  const setDraft = (id: string, r: T) => setDrafts((d) => ({ ...d, [id]: r }));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>{title}</CardTitle>
        <Button size="sm" variant="outline" onClick={() => setNewDraft(newRow())}>
          <Plus className="mr-1 h-4 w-4" /> Adicionar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {rows.map((r) => {
          const draft = drafts[r.id!] ?? r;
          const dirty = JSON.stringify(draft) !== JSON.stringify(r);
          return (
            <div key={r.id} className="rounded-md border bg-muted/30 p-3 space-y-2">
              {render(draft, (n) => setDraft(r.id!, n))}
              <div className="flex justify-end gap-2">
                {dirty && (
                  <Button size="sm" onClick={async () => { await onSave(draft); setDrafts((d) => { const nd = { ...d }; delete nd[r.id!]; return nd; }); toast.success("Salvo"); }}>
                    <Save className="mr-1 h-4 w-4" /> Salvar
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Excluir?")) { await onDelete(r.id!); toast.success("Excluído"); } }}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          );
        })}
        {newDraft && (
          <div className="rounded-md border-2 border-dashed border-primary/40 bg-primary/5 p-3 space-y-2">
            {render(newDraft, setNewDraft)}
            <div className="flex justify-end gap-2">
              <Button size="sm" variant="ghost" onClick={() => setNewDraft(null)}>Cancelar</Button>
              <Button size="sm" onClick={async () => { await onSave(newDraft); setNewDraft(null); toast.success("Adicionado"); }}>
                <Save className="mr-1 h-4 w-4" /> Salvar
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ============ User Stories ============
function UserStoriesTab({ projectId, rows, onChange }: { projectId: string; rows: TmsUserStory[]; onChange: () => void }) {
  const up = useServerFn(upsertUserStory);
  const del = useServerFn(deleteRow);
  const [filter, setFilter] = useState<string>("all");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Visualizar:</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas ({rows.length})</SelectItem>
              {rows.map((u, i) => <SelectItem key={u.id} value={u.id}>{u.us_id || `US #${i + 1}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <RowEditor
        title=""
        rows={rows}
        newRow={() => ({ project_id: projectId, us_id: "", modulo: "", ator: "", story: "", criterio1: "", criterio2: "", prioridade: "Média", sprint: "", status: "A Documentar" }) as TmsUserStory}
        onSave={async (r) => { await up({ data: r as any }); onChange(); }}
        onDelete={async (id) => { await del({ data: { table: "user_stories", id } }); onChange(); }}
        render={(r, upd) => (
          (filter === "all" || filter === r.id || !r.id) && (
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="ID_US"><Input placeholder="US-MOD-001" value={r.us_id} onChange={(e) => upd({ ...r, us_id: e.target.value })} /></Field>
              <Field label="Módulo"><Input value={r.modulo} onChange={(e) => upd({ ...r, modulo: e.target.value })} /></Field>
              <Field label="Ator / Perfil"><Input value={r.ator} onChange={(e) => upd({ ...r, ator: e.target.value })} /></Field>
              <Field label="User Story (Eu como… Quero… Para que…)" className="md:col-span-3">
                <Textarea rows={3} value={r.story} onChange={(e) => upd({ ...r, story: e.target.value })} />
              </Field>
              <Field label="Critério de Aceitação 1" className="md:col-span-3"><Textarea rows={2} value={r.criterio1} onChange={(e) => upd({ ...r, criterio1: e.target.value })} /></Field>
              <Field label="Critério de Aceitação 2" className="md:col-span-3"><Textarea rows={2} value={r.criterio2} onChange={(e) => upd({ ...r, criterio2: e.target.value })} /></Field>
              <Field label="Prioridade">
                <Select value={r.prioridade} onValueChange={(v) => upd({ ...r, prioridade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Alta", "Média", "Baixa"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Sprint / Release"><Input value={r.sprint} onChange={(e) => upd({ ...r, sprint: e.target.value })} /></Field>
              <Field label="Status">
                <Select value={r.status} onValueChange={(v) => upd({ ...r, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["A Documentar", "Em Desenvolvimento", "Pronto para Teste", "Em Teste", "Aprovado", "Rejeitado"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          )
        )}
      />
    </div>
  );
}

// ============ Test Cases ============
function TestCasesTab({ projectId, rows, onChange }: { projectId: string; rows: TmsTestCase[]; onChange: () => void }) {
  const up = useServerFn(upsertTestCase);
  const del = useServerFn(deleteRow);
  const [filter, setFilter] = useState<string>("all");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Label className="text-xs text-muted-foreground">Visualizar:</Label>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-9 w-[240px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos ({rows.length})</SelectItem>
              {rows.map((c, i) => <SelectItem key={c.id} value={c.id}>{c.ct_id || `CT #${i + 1}`}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <RowEditor
        title=""
        rows={rows}
        newRow={() => ({ project_id: projectId, ct_id: "", id_us: "", modulo: "", tipo: "Funcional", precondicoes: "", massa: "", passos: "", esperado: "", obtido: "", status: "Pendente", evidencia: "", observacoes: "" }) as TmsTestCase}
        onSave={async (r) => { await up({ data: r as any }); onChange(); }}
        onDelete={async (id) => { await del({ data: { table: "test_cases", id } }); onChange(); }}
        render={(r, upd) => (
          (filter === "all" || filter === r.id || !r.id) && (
            <div className="grid gap-3 md:grid-cols-4">
              <Field label="ID_CT"><Input placeholder="CT-MOD-001" value={r.ct_id} onChange={(e) => upd({ ...r, ct_id: e.target.value })} /></Field>
              <Field label="ID_US"><Input placeholder="US-MOD-001" value={r.id_us} onChange={(e) => upd({ ...r, id_us: e.target.value })} /></Field>
              <Field label="Módulo"><Input value={r.modulo} onChange={(e) => upd({ ...r, modulo: e.target.value })} /></Field>
              <Field label="Tipo">
                <Select value={r.tipo} onValueChange={(v) => upd({ ...r, tipo: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["Funcional", "Não Funcional", "Integração", "Usabilidade", "Performance", "Segurança", "Regressão", "Smoke"].map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Pré-condições" className="md:col-span-2"><Textarea rows={3} value={r.precondicoes} onChange={(e) => upd({ ...r, precondicoes: e.target.value })} /></Field>
              <Field label="Massa de Dados" className="md:col-span-2"><Textarea rows={3} value={r.massa} onChange={(e) => upd({ ...r, massa: e.target.value })} /></Field>
              <Field label="Passo a Passo" className="md:col-span-2"><Textarea rows={4} value={r.passos} onChange={(e) => upd({ ...r, passos: e.target.value })} /></Field>
              <Field label="Resultado Esperado" className="md:col-span-2"><Textarea rows={4} value={r.esperado} onChange={(e) => upd({ ...r, esperado: e.target.value })} /></Field>
              <Field label="Observações" className="md:col-span-4"><Textarea rows={2} value={r.observacoes} onChange={(e) => upd({ ...r, observacoes: e.target.value })} /></Field>
            </div>
          )
        )}
      />
    </div>
  );
}

// ============ Execution ============
function statusBadge(s: TestStatus) {
  const map: Record<TestStatus, { c: string; i: React.ReactNode }> = {
    "Pendente": { c: "bg-muted text-muted-foreground", i: <Circle className="h-3 w-3" /> },
    "Passou": { c: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300", i: <CheckCircle2 className="h-3 w-3" /> },
    "Falhou": { c: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300", i: <XCircle className="h-3 w-3" /> },
    "Bloqueado": { c: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300", i: <ShieldAlert className="h-3 w-3" /> },
  };
  const it = map[s];
  return <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${it.c}`}>{it.i} {s}</span>;
}

type StatusFilter = "all" | TestStatus;

function ExecutionTab({ projectId, rows, onChange }: { projectId: string; rows: TmsTestCase[]; onChange: () => void }) {
  const execTC = useServerFn(executeTestCase);
  const upBug = useServerFn(upsertBug);
  const [selected, setSelected] = useState<TmsTestCase | null>(null);
  const [obtido, setObtido] = useState("");
  const [evidencia, setEvidencia] = useState("");
  const [bugDialog, setBugDialog] = useState<{ ct: TmsTestCase } | null>(null);

  // Filters
  const [fStatus, setFStatus] = useState<StatusFilter>("all");
  const [fModulo, setFModulo] = useState<string>("all");
  const [fFrom, setFFrom] = useState<string>("");
  const [fTo, setFTo] = useState<string>("");

  const modulos = useMemo(() => {
    const s = new Set(rows.map((r) => r.modulo).filter(Boolean));
    return Array.from(s).sort();
  }, [rows]);

  const filtered = useMemo(() => {
    const fromMs = fFrom ? new Date(fFrom + "T00:00:00").getTime() : null;
    const toMs = fTo ? new Date(fTo + "T23:59:59.999").getTime() : null;
    return rows.filter((r) => {
      if (fStatus !== "all" && r.status !== fStatus) return false;
      if (fModulo !== "all" && r.modulo !== fModulo) return false;
      if (fromMs !== null || toMs !== null) {
        if (!r.executado_em) return false;
        const t = new Date(r.executado_em).getTime();
        if (fromMs !== null && t < fromMs) return false;
        if (toMs !== null && t > toMs) return false;
      }
      return true;
    });
  }, [rows, fStatus, fModulo, fFrom, fTo]);

  // List obeys filters strictly (no hard-coded pendente/falhou restriction)


  const summary = useMemo(() => {
    const total = filtered.length;
    const c = (s: TestStatus) => filtered.filter((r) => r.status === s).length;
    const passou = c("Passou");
    const falhou = c("Falhou");
    const pend = c("Pendente");
    const pctOk = total ? Math.round((passou / total) * 100) : 0;
    const pctBad = total ? Math.round((falhou / total) * 100) : 0;
    return { total, passou, falhou, pend, pctOk, pctBad };
  }, [filtered]);

  function clearFilters() {
    setFStatus("all"); setFModulo("all"); setFFrom(""); setFTo("");
  }
  const filtersActive = fStatus !== "all" || fModulo !== "all" || !!fFrom || !!fTo;

  function openTest(ct: TmsTestCase) {
    setSelected(ct);
    setObtido(ct.obtido || "");
    setEvidencia(ct.evidencia || "");
  }

  async function execute(status: "Passou" | "Falhou") {
    if (!selected) return;
    const res = await execTC({ data: { id: selected.id, status, obtido, evidencia } });
    const updated: TmsTestCase = { ...selected, obtido, evidencia, status, executado_em: res.executado_em, executor: res.executor };
    onChange();
    if (status === "Passou") {
      toast.success("Teste aprovado");
      setSelected(null);
    } else {
      setBugDialog({ ct: updated });
    }
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-base">Filtros</CardTitle>
          {filtersActive && (
            <Button size="sm" variant="ghost" onClick={clearFilters}>Limpar filtros</Button>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-4">
          <Field label="Status">
            <Select value={fStatus} onValueChange={(v) => setFStatus(v as StatusFilter)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {(["Pendente", "Passou", "Falhou", "Bloqueado"] as TestStatus[]).map((s) =>
                  <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Módulo">
            <Select value={fModulo} onValueChange={setFModulo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {modulos.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Executado de">
            <Input type="date" value={fFrom} onChange={(e) => setFFrom(e.target.value)} />
          </Field>
          <Field label="Executado até">
            <Input type="date" value={fTo} onChange={(e) => setFTo(e.target.value)} />
          </Field>
        </CardContent>
      </Card>

      {/* Metric cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Total de Testes" value={summary.total} />
        <Stat label="% Sucesso" value={`${summary.pctOk}%`} tone="ok" />
        <Stat label="% Falha" value={`${summary.pctBad}%`} tone="bad" />
        <Stat label="Pendentes" value={summary.pend} tone="warn" />
      </div>

      {rows.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum caso de teste. Cadastre em "CT" primeiro.</CardContent></Card>}
      {rows.length > 0 && filtered.length === 0 && (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum caso de teste encontrado para os filtros selecionados.</CardContent></Card>
      )}

      <div className="space-y-2">
        {filtered.map((ct) => (
          <Card key={ct.id} className="cursor-pointer transition-colors hover:bg-accent/50" onClick={() => openTest(ct)}>
            <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs text-muted-foreground">{ct.ct_id || "(sem ID)"}</span>
                  {statusBadge(ct.status)}
                  {ct.id_us && <span className="text-xs text-muted-foreground">US: {ct.id_us}</span>}
                  {ct.modulo && <span className="text-xs text-muted-foreground">• {ct.modulo}</span>}
                  {ct.executado_em && (
                    <span className="text-xs text-muted-foreground">
                      • última: {new Date(ct.executado_em).toLocaleString("pt-BR")}{ct.executor ? ` por ${ct.executor}` : ""}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-sm line-clamp-1">{ct.esperado || ct.passos || ct.modulo || "(sem descrição)"}</p>
              </div>
              {ct.status === "Pendente"
                ? <Button size="sm" variant="outline">Executar</Button>
                : <Button size="sm" variant="secondary">Editar Execução</Button>}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <span className="font-mono">{selected?.ct_id || "CT"}</span>
              {selected && statusBadge(selected.status)}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid gap-3 md:grid-cols-3 rounded-md border bg-muted/30 p-3 text-sm">
                <div><span className="text-xs text-muted-foreground">User Story</span><p className="font-mono">{selected.id_us || "—"}</p></div>
                <div><span className="text-xs text-muted-foreground">Módulo</span><p>{selected.modulo || "—"}</p></div>
                <div><span className="text-xs text-muted-foreground">Tipo</span><p>{selected.tipo || "—"}</p></div>
              </div>
              <ReadOnlyBlock label="Pré-condições" value={selected.precondicoes} />
              <ReadOnlyBlock label="Massa de Dados" value={selected.massa} />
              <ReadOnlyBlock label="Passo a Passo" value={selected.passos} />
              <ReadOnlyBlock label="Resultado Esperado" value={selected.esperado} />

              <div className="border-t pt-4 space-y-3">
                <Field label="Resultado Obtido">
                  <Textarea rows={3} value={obtido} onChange={(e) => setObtido(e.target.value)} placeholder="Descreva o que aconteceu na execução..." />
                </Field>
                <Field label="Evidência (link/arquivo)">
                  <Input value={evidencia} onChange={(e) => setEvidencia(e.target.value)} placeholder="URL do print, vídeo, log..." />
                </Field>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="ghost" onClick={() => setSelected(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={() => execute("Falhou")}>
              <XCircle className="mr-2 h-4 w-4" /> Falhou
            </Button>
            <Button onClick={() => execute("Passou")} className="bg-green-600 hover:bg-green-700 text-white">
              <CheckCircle2 className="mr-2 h-4 w-4" /> Passou
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BugDialog
        open={!!bugDialog}
        ct={bugDialog?.ct ?? null}
        projectId={projectId}
        onClose={() => { setBugDialog(null); setSelected(null); }}
        onSave={async (b) => { await upBug({ data: b as any }); onChange(); setBugDialog(null); setSelected(null); toast.success("Bug registrado"); }}
      />
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: "ok" | "bad" | "warn" }) {
  const cls = tone === "ok" ? "text-green-600" : tone === "bad" ? "text-red-600" : tone === "warn" ? "text-amber-600" : "text-foreground";
  return (
    <div className="rounded-md border bg-card p-3">
      <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

function ReadOnlyBlock({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <Label className="text-xs font-medium text-muted-foreground">{label}</Label>
      <div className="mt-1 rounded-md border bg-muted/20 p-2 text-sm whitespace-pre-wrap min-h-[2rem]">
        {value || <span className="text-muted-foreground italic">(vazio)</span>}
      </div>
    </div>
  );
}

// ============ Bugs ============
function BugDialog({ open, ct, projectId, onClose, onSave }: {
  open: boolean; ct: TmsTestCase | null; projectId: string;
  onClose: () => void; onSave: (b: Partial<TmsBug>) => Promise<void>;
}) {
  const [b, setB] = useState<Partial<TmsBug>>({});
  useEffect(() => {
    if (ct) setB({
      project_id: projectId, test_case_id: ct.id,
      bug_id: `BUG-${Date.now().toString(36).toUpperCase().slice(-5)}`,
      titulo: `Falha em ${ct.ct_id || "CT"}`,
      severidade: "Média", status: "Aberto",
      passos: ct.passos, massa: ct.massa,
      comportamento_atual: ct.obtido, comportamento_esperado: ct.esperado,
    });
  }, [ct, projectId]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader><DialogTitle className="flex items-center gap-2"><BugIcon className="h-5 w-5 text-red-600" /> Registrar Bug</DialogTitle></DialogHeader>
        <div className="grid gap-3 md:grid-cols-2">
          <Field label="ID do Bug"><Input value={b.bug_id ?? ""} onChange={(e) => setB({ ...b, bug_id: e.target.value })} /></Field>
          <Field label="Severidade">
            <Select value={b.severidade as string} onValueChange={(v) => setB({ ...b, severidade: v as BugSeverity })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["Alta", "Média", "Baixa"] as BugSeverity[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <Field label="Título" className="md:col-span-2"><Input value={b.titulo ?? ""} onChange={(e) => setB({ ...b, titulo: e.target.value })} /></Field>
          <Field label="Passos (do CT)" className="md:col-span-2"><Textarea rows={3} value={b.passos ?? ""} onChange={(e) => setB({ ...b, passos: e.target.value })} /></Field>
          <Field label="Massa de Dados (do CT)" className="md:col-span-2"><Textarea rows={2} value={b.massa ?? ""} onChange={(e) => setB({ ...b, massa: e.target.value })} /></Field>
          <Field label="Comportamento Atual"><Textarea rows={3} value={b.comportamento_atual ?? ""} onChange={(e) => setB({ ...b, comportamento_atual: e.target.value })} /></Field>
          <Field label="Comportamento Esperado"><Textarea rows={3} value={b.comportamento_esperado ?? ""} onChange={(e) => setB({ ...b, comportamento_esperado: e.target.value })} /></Field>
          <Field label="Status">
            <Select value={b.status as string} onValueChange={(v) => setB({ ...b, status: v as BugStatus })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{(["Aberto", "Em Correção", "Corrigido", "Retestado"] as BugStatus[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={() => onSave(b)}><Save className="mr-2 h-4 w-4" /> Registrar Bug</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BugsTab({ projectId, rows, testCases, onChange }: {
  projectId: string; rows: TmsBug[]; testCases: TmsTestCase[]; onChange: () => void;
}) {
  const up = useServerFn(upsertBug);
  const del = useServerFn(deleteRow);
  const [newDialog, setNewDialog] = useState(false);
  const [editing, setEditing] = useState<TmsBug | null>(null);
  const ctMap = useMemo(() => Object.fromEntries(testCases.map((c) => [c.id, c.ct_id])), [testCases]);

  const sevColor: Record<BugSeverity, string> = {
    "Alta": "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300",
    "Média": "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
    "Baixa": "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  };

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={() => setNewDialog(true)}><Plus className="mr-2 h-4 w-4" /> Novo Bug</Button>
      </div>
      {rows.length === 0 && <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Nenhum bug registrado.</CardContent></Card>}
      {rows.map((b) => (
        <Card key={b.id}>
          <CardContent className="flex flex-wrap items-center justify-between gap-3 py-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono text-xs text-muted-foreground">{b.bug_id}</span>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${sevColor[b.severidade]}`}>{b.severidade}</span>
                <Badge variant={b.status === "Corrigido" || b.status === "Retestado" ? "secondary" : "default"}>{b.status}</Badge>
                {b.test_case_id && <span className="text-xs text-muted-foreground">CT: {ctMap[b.test_case_id] ?? "—"}</span>}
              </div>
              <p className="mt-1 text-sm font-medium">{b.titulo || "(sem título)"}</p>
              <p className="text-xs text-muted-foreground line-clamp-1">{b.comportamento_atual}</p>
            </div>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setEditing(b)}>Editar</Button>
              <Button size="sm" variant="ghost" onClick={async () => { if (confirm("Excluir?")) { await del({ data: { table: "bugs", id: b.id } }); onChange(); toast.success("Excluído"); } }}><Trash2 className="h-4 w-4" /></Button>
            </div>
          </CardContent>
        </Card>
      ))}

      {newDialog && (
        <BugDialog
          open
          ct={null}
          projectId={projectId}
          onClose={() => setNewDialog(false)}
          onSave={async (b) => { await up({ data: { ...b, project_id: projectId, bug_id: b.bug_id || `BUG-${Date.now().toString(36).slice(-5)}` } as any }); onChange(); setNewDialog(false); toast.success("Bug criado"); }}
        />
      )}
      {editing && (
        <Dialog open onOpenChange={(o) => !o && setEditing(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader><DialogTitle>Editar bug {editing.bug_id}</DialogTitle></DialogHeader>
            <EditBugForm bug={editing} onSave={async (b) => { await up({ data: b as any }); onChange(); setEditing(null); toast.success("Bug atualizado"); }} onCancel={() => setEditing(null)} />
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

function EditBugForm({ bug, onSave, onCancel }: { bug: TmsBug; onSave: (b: TmsBug) => Promise<void>; onCancel: () => void }) {
  const [b, setB] = useState<TmsBug>(bug);
  return (
    <>
      <div className="grid gap-3 md:grid-cols-2">
        <Field label="ID"><Input value={b.bug_id} onChange={(e) => setB({ ...b, bug_id: e.target.value })} /></Field>
        <Field label="Severidade">
          <Select value={b.severidade} onValueChange={(v) => setB({ ...b, severidade: v as BugSeverity })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(["Alta", "Média", "Baixa"] as BugSeverity[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
        <Field label="Título" className="md:col-span-2"><Input value={b.titulo} onChange={(e) => setB({ ...b, titulo: e.target.value })} /></Field>
        <Field label="Comportamento Atual"><Textarea rows={3} value={b.comportamento_atual} onChange={(e) => setB({ ...b, comportamento_atual: e.target.value })} /></Field>
        <Field label="Comportamento Esperado"><Textarea rows={3} value={b.comportamento_esperado} onChange={(e) => setB({ ...b, comportamento_esperado: e.target.value })} /></Field>
        <Field label="Status">
          <Select value={b.status} onValueChange={(v) => setB({ ...b, status: v as BugStatus })}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{(["Aberto", "Em Correção", "Corrigido", "Retestado"] as BugStatus[]).map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <DialogFooter className="mt-4">
        <Button variant="ghost" onClick={onCancel}>Cancelar</Button>
        <Button onClick={() => onSave(b)}><Save className="mr-2 h-4 w-4" /> Salvar</Button>
      </DialogFooter>
    </>
  );
}

// ============ Audit ============
const ENTITY_LABEL: Record<string, string> = {
  test_cases: "Caso de Teste",
  bugs: "Bug",
  user_stories: "User Story",
  risks: "Risco",
  schedule_items: "Atividade",
  projects: "Projeto",
};

const FIELD_LABEL: Record<string, string> = {
  status: "Status", titulo: "Título", severidade: "Severidade", prioridade: "Prioridade",
  descricao: "Descrição", modulo: "Módulo", ator: "Ator", sprint: "Sprint",
  story: "User Story", criterio1: "Critério 1", criterio2: "Critério 2",
  precondicoes: "Pré-condições", massa: "Massa de Dados", passos: "Passos",
  esperado: "Resultado Esperado", obtido: "Resultado Obtido", evidencia: "Evidência",
  observacoes: "Observações", tipo: "Tipo", ct_id: "ID CT", us_id: "ID US",
  bug_id: "ID Bug", risco_id: "ID Risco", id_us: "US Vinculada", fase: "Fase",
  atividade: "Atividade", inicio: "Início", fim: "Fim", responsavel: "Responsável",
  impacto: "Impacto", probabilidade: "Probabilidade", mitigacao: "Mitigação",
  comportamento_atual: "Comportamento Atual", comportamento_esperado: "Comportamento Esperado",
  ordem: "Ordem", projeto: "Projeto", versao: "Versão", ambiente: "Ambiente",
  objetivo: "Objetivo", in_scope: "In Scope", out_of_scope: "Out of Scope",
  executado_em: "Executado em", executor: "Executor",
};

const SKIP_FIELDS = new Set(["id", "project_id", "created_at", "updated_at", "owner_id"]);

function friendlyEntity(entity: string, snap: any): string {
  const base = ENTITY_LABEL[entity] ?? entity;
  if (!snap || typeof snap !== "object") return base;
  switch (entity) {
    case "test_cases": return `${base} ${snap.ct_id || "(sem ID)"}`;
    case "bugs": return `${base} ${snap.bug_id || "(sem ID)"}${snap.severidade ? ` (Severidade: ${snap.severidade})` : ""}`;
    case "user_stories": return `${base} ${snap.us_id || "(sem ID)"}`;
    case "risks": return `${base} ${snap.risco_id || "(sem ID)"}`;
    case "schedule_items": return `${base}: ${snap.atividade || snap.fase || "(sem descrição)"}`;
    case "projects": return `${base} ${snap.projeto || ""}`.trim();
    default: return base;
  }
}

function fmtVal(v: unknown): string {
  if (v === null || v === undefined || v === "") return "(vazio)";
  if (typeof v === "object") return JSON.stringify(v);
  const s = String(v);
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}

function diffFields(oldV: any, newV: any): Array<{ field: string; old: unknown; new: unknown }> {
  if (!oldV || !newV || typeof oldV !== "object" || typeof newV !== "object") return [];
  const keys = new Set([...Object.keys(oldV), ...Object.keys(newV)]);
  const out: Array<{ field: string; old: unknown; new: unknown }> = [];
  for (const k of keys) {
    if (SKIP_FIELDS.has(k)) continue;
    if (JSON.stringify(oldV[k]) !== JSON.stringify(newV[k])) {
      out.push({ field: FIELD_LABEL[k] ?? k, old: oldV[k], new: newV[k] });
    }
  }
  return out;
}

const ACTION_LABEL = { create: "Criado", update: "Atualizado", delete: "Excluído" } as const;
const ACTION_CLASS: Record<string, string> = {
  create: "bg-green-100 text-green-800 dark:bg-green-950 dark:text-green-300 border-green-200",
  update: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 border-blue-200",
  delete: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300 border-red-200",
};

function AuditTab({ projectId }: { projectId: string }) {
  const fn = useServerFn(listAudit);
  const { data, isPending } = useQuery({ queryKey: ["audit", projectId], queryFn: () => fn({ data: { project_id: projectId } }) });
  const [open, setOpen] = useState<Record<string, boolean>>({});

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><History className="h-4 w-4" /> Trilha de Auditoria</CardTitle></CardHeader>
      <CardContent>
        {isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}
        {data?.length === 0 && <p className="text-sm text-muted-foreground">Sem atividade registrada.</p>}
        <div className="space-y-2">
          {data?.map((log) => {
            const diff = log.diff as any;
            const snap = log.action === "update" ? diff?.new : diff;
            const changes = log.action === "update" ? diffFields(diff?.old, diff?.new) : [];
            const author = (log as any).actor_label || (log.actor_id ? log.actor_id.slice(0, 8) : "sistema");
            const isOpen = !!open[log.id];
            const expandable = log.action === "update" && changes.length > 0;

            return (
              <div key={log.id} className="rounded-md border bg-card">
                <button
                  type="button"
                  onClick={() => expandable && setOpen((o) => ({ ...o, [log.id]: !o[log.id] }))}
                  className={`w-full flex flex-wrap items-center gap-2 px-3 py-2 text-left text-sm ${expandable ? "cursor-pointer hover:bg-accent/40" : "cursor-default"}`}
                >
                  <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${ACTION_CLASS[log.action]}`}>
                    {ACTION_LABEL[log.action]}
                  </span>
                  <span className="font-medium">{friendlyEntity(log.entity, snap)}</span>
                  <span className="text-xs text-muted-foreground">Por: {author}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
                  {expandable && (
                    <span className="text-xs text-muted-foreground">{isOpen ? "▲" : "▼"} {changes.length} campo(s)</span>
                  )}
                </button>
                {expandable && isOpen && (
                  <div className="border-t bg-muted/30 px-3 py-2 space-y-1">
                    {changes.map((c, i) => (
                      <div key={i} className="text-xs">
                        <span className="font-medium">{c.field}</span> alterado de{" "}
                        <span className="rounded bg-red-100 px-1 py-0.5 text-red-800 dark:bg-red-950 dark:text-red-300">{fmtVal(c.old)}</span>{" "}
                        para{" "}
                        <span className="rounded bg-green-100 px-1 py-0.5 text-green-800 dark:bg-green-950 dark:text-green-300">{fmtVal(c.new)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

// ============ Matriz ============
function MatrizTab({ userStories, testCases }: { userStories: TmsUserStory[]; testCases: TmsTestCase[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Matriz de Rastreabilidade</CardTitle>
        <p className="text-sm text-muted-foreground">Gerada automaticamente a partir do campo ID_US dos casos de teste.</p>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-muted">
              <th className="border p-2 text-left">ID_US</th>
              <th className="border p-2 text-left">Módulo</th>
              {testCases.map((c) => <th key={c.id} className="border p-2 text-center">{c.ct_id || "?"}</th>)}
              <th className="border p-2 text-center">Cobertura</th>
            </tr>
          </thead>
          <tbody>
            {userStories.map((us) => {
              const cover = testCases.map((ct) => ct.id_us.split(/[,;\s]+/).includes(us.us_id));
              const total = cover.filter(Boolean).length;
              const pct = testCases.length ? Math.round((total / testCases.length) * 100) : 0;
              return (
                <tr key={us.id}>
                  <td className="border p-2 font-medium">{us.us_id}</td>
                  <td className="border p-2">{us.modulo}</td>
                  {cover.map((b, j) => <td key={j} className="border p-2 text-center">{b ? "✅" : "🔲"}</td>)}
                  <td className={`border p-2 text-center font-semibold ${total ? "text-green-600" : "text-red-600"}`}>{pct}%</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

// ============================================================
// Members Tab
// ============================================================

const ROLE_LABEL: Record<ProjectRole, string> = {
  owner: "Proprietário",
  admin: "Administrador",
  collaborator: "Colaborador",
  viewer: "Visualizador",
};

const ROLE_BADGE: Record<ProjectRole, string> = {
  owner: "bg-purple-100 text-purple-800",
  admin: "bg-blue-100 text-blue-800",
  collaborator: "bg-green-100 text-green-800",
  viewer: "bg-slate-100 text-slate-700",
};

function MembersTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const members = useQuery({
    queryKey: ["members", projectId],
    queryFn: () => listMembers({ data: { project_id: projectId } }),
  });
  const invites = useQuery({
    queryKey: ["invitations", projectId],
    queryFn: () => listInvitations({ data: { project_id: projectId } }),
  });

  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<ProjectRole>("collaborator");
  const [busy, setBusy] = useState(false);
  const [lastLink, setLastLink] = useState<string | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ["members", projectId] });
    qc.invalidateQueries({ queryKey: ["invitations", projectId] });
  };

  const linkFor = (token: string) =>
    typeof window !== "undefined" ? `${window.location.origin}/invite/${token}` : `/invite/${token}`;

  async function copy(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Link copiado!");
    } catch {
      toast.error("Copie manualmente: " + text);
    }
  }

  async function submitInvite() {
    if (!email.trim()) return;
    setBusy(true);
    try {
      const res = await inviteMember({ data: { project_id: projectId, email, role } });
      const link = linkFor(res.invitation.token);
      setLastLink(link);
      toast.success(res.existingUser ? "Convite criado — usuário já cadastrado." : "Convite criado.");
      setEmail("");
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? "Falha ao convidar.");
    } finally {
      setBusy(false);
    }
  }

  async function changeRole(id: string, r: ProjectRole) {
    try {
      await updateMemberRole({ data: { id, role: r } });
      toast.success("Permissão atualizada.");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Falha."); }
  }
  async function kick(id: string) {
    if (!confirm("Remover este membro do projeto?")) return;
    try {
      await removeMember({ data: { id } });
      toast.success("Membro removido.");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Falha."); }
  }
  async function resend(id: string) {
    try {
      const inv = await resendInvitation({ data: { id } });
      setLastLink(linkFor(inv.token));
      toast.success("Convite renovado.");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Falha."); }
  }
  async function revoke(id: string) {
    if (!confirm("Revogar este convite?")) return;
    try {
      await revokeInvitation({ data: { id } });
      toast.success("Convite revogado.");
      refresh();
    } catch (e: any) { toast.error(e?.message ?? "Falha."); }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Membros do projeto</CardTitle>
          <Button size="sm" onClick={() => { setLastLink(null); setOpen(true); }}>
            <Plus className="mr-1 h-4 w-4" /> Convidar membro
          </Button>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {members.isPending ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">Nome</th>
                  <th className="py-2 pr-3">E-mail</th>
                  <th className="py-2 pr-3">Permissão</th>
                  <th className="py-2 pr-3">Desde</th>
                  <th className="py-2 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(members.data ?? []).map((m) => (
                  <tr key={m.id} className="border-t">
                    <td className="py-2 pr-3 font-medium">{m.name || "—"}</td>
                    <td className="py-2 pr-3">{m.email || m.user_id.slice(0, 8)}</td>
                    <td className="py-2 pr-3">
                      {m.role === "owner" ? (
                        <span className={`inline-block rounded px-2 py-0.5 text-xs ${ROLE_BADGE[m.role]}`}>
                          {ROLE_LABEL[m.role]}
                        </span>
                      ) : (
                        <Select value={m.role} onValueChange={(v) => changeRole(m.id, v as ProjectRole)}>
                          <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                            <SelectItem value="collaborator">{ROLE_LABEL.collaborator}</SelectItem>
                            <SelectItem value="viewer">{ROLE_LABEL.viewer}</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    </td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {m.accepted_at ? new Date(m.accepted_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="py-2 pr-3 text-right">
                      {m.role !== "owner" && (
                        <Button size="sm" variant="ghost" onClick={() => kick(m.id)}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
                {(members.data ?? []).length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum membro.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Convites pendentes</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {invites.isPending ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-3">E-mail</th>
                  <th className="py-2 pr-3">Permissão</th>
                  <th className="py-2 pr-3">Status</th>
                  <th className="py-2 pr-3">Expira</th>
                  <th className="py-2 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {(invites.data ?? []).map((i) => (
                  <tr key={i.id} className="border-t">
                    <td className="py-2 pr-3">{i.email}</td>
                    <td className="py-2 pr-3">
                      <span className={`inline-block rounded px-2 py-0.5 text-xs ${ROLE_BADGE[i.role]}`}>
                        {ROLE_LABEL[i.role]}
                      </span>
                    </td>
                    <td className="py-2 pr-3 text-xs">{i.status}</td>
                    <td className="py-2 pr-3 text-xs text-muted-foreground">
                      {new Date(i.expires_at).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-3 text-right space-x-1">
                      <Button size="sm" variant="ghost" onClick={() => copy(linkFor(i.token))} title="Copiar link">
                        <Copy className="h-4 w-4" />
                      </Button>
                      {i.status !== "accepted" && (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => resend(i.id)} title="Renovar">
                            <RefreshCw className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => revoke(i.id)} title="Revogar">
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
                {(invites.data ?? []).length === 0 && (
                  <tr><td colSpan={5} className="py-6 text-center text-muted-foreground">Nenhum convite.</td></tr>
                )}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Convidar membro</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">E-mail</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="pessoa@empresa.com" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Permissão</Label>
              <Select value={role} onValueChange={(v) => setRole(v as ProjectRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">{ROLE_LABEL.admin}</SelectItem>
                  <SelectItem value="collaborator">{ROLE_LABEL.collaborator}</SelectItem>
                  <SelectItem value="viewer">{ROLE_LABEL.viewer}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {lastLink && (
              <div className="rounded-md border bg-muted/50 p-3 text-xs space-y-2">
                <p className="text-muted-foreground">Envie este link ao convidado:</p>
                <div className="flex items-center gap-2">
                  <Input value={lastLink} readOnly className="text-xs" />
                  <Button size="sm" variant="outline" onClick={() => copy(lastLink)}>
                    <Copy className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Fechar</Button>
            <Button onClick={submitInvite} disabled={busy || !email.trim()}>
              <Send className="mr-1 h-4 w-4" /> {busy ? "Enviando…" : "Enviar convite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ---------------- Request Access Screen ----------------
function RequestAccessScreen({ projectId, onSignOut }: { projectId: string; onSignOut: () => void }) {
  const qc = useQueryClient();
  const preview = useQuery({
    queryKey: ["project-preview", projectId],
    queryFn: () => getProjectPreview({ data: { project_id: projectId } }),
    staleTime: 15_000,
  });
  const [msg, setMsg] = useState("");
  const reqM = useMutation({
    mutationFn: () => requestProjectAccess({ data: { project_id: projectId, message: msg || undefined } }),
    onSuccess: () => {
      toast.success("Solicitação enviada!");
      qc.invalidateQueries({ queryKey: ["project-preview", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const p = preview.data;
  const pending = p?.my_request_status === "pending";

  return (
    <div className="min-h-screen bg-slate-50/60">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Meus projetos</Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={onSignOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-6 py-16">
        {preview.isPending && <p className="text-sm text-muted-foreground text-center">Carregando…</p>}
        {!preview.isPending && !p && (
          <Card className="rounded-xl border-slate-200/70 bg-white shadow-sm">
            <CardContent className="py-14 text-center text-sm text-muted-foreground">
              Projeto não encontrado ou indisponível.
            </CardContent>
          </Card>
        )}
        {p && (
          <Card className="rounded-xl border-slate-200/70 bg-white shadow-sm">
            <CardHeader className="text-center pb-4">
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                <ShieldAlert className="h-7 w-7" />
              </div>
              <CardTitle className="mt-4 text-xl">{p.projeto || "Projeto"}</CardTitle>
              <p className="text-sm text-muted-foreground">
                Este projeto pertence a <b>{p.owner_name || p.owner_email || "outro usuário"}</b>
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xl font-semibold">{p.member_count}</div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Membros</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3">
                  <div className="text-xl font-semibold inline-flex items-center gap-1 justify-center">
                    <Crown className="h-4 w-4 text-amber-500" />
                    <span className="truncate text-sm">{(p.owner_name || p.owner_email || "").split(" ")[0] || "—"}</span>
                  </div>
                  <div className="text-[11px] uppercase tracking-wider text-muted-foreground">Proprietário</div>
                </div>
              </div>
              {p.objetivo && (
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground">Descrição</Label>
                  <p className="mt-1 text-sm text-slate-700 whitespace-pre-wrap">{p.objetivo}</p>
                </div>
              )}
              {pending ? (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-center">
                  <Clock className="mx-auto h-6 w-6 text-amber-600" />
                  <p className="mt-2 text-sm font-medium text-amber-900">Solicitação pendente</p>
                  <p className="text-xs text-amber-700">Aguardando aprovação do proprietário.</p>
                </div>
              ) : p.my_request_status === "rejected" ? (
                <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-center">
                  <XCircle className="mx-auto h-6 w-6 text-rose-600" />
                  <p className="mt-2 text-sm font-medium text-rose-900">Sua última solicitação foi recusada</p>
                  <p className="text-xs text-rose-700">Você pode solicitar novamente abaixo, se preciso.</p>
                </div>
              ) : null}

              {!pending && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Mensagem (opcional)</Label>
                  <Textarea
                    value={msg}
                    onChange={(e) => setMsg(e.target.value)}
                    placeholder="Conte ao proprietário por que você precisa de acesso…"
                    rows={3}
                  />
                  <Button className="w-full" onClick={() => reqM.mutate()} disabled={reqM.isPending}>
                    <Send className="mr-2 h-4 w-4" /> Solicitar acesso ao projeto
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}

// ---------------- Pending Access Requests Panel (inside Members tab) ----------------
function PendingAccessRequestsPanel({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const q = useQuery({
    queryKey: ["access-requests", projectId],
    queryFn: () => listAccessRequests({ data: { project_id: projectId } }),
    staleTime: 15_000,
  });
  const decideM = useMutation({
    mutationFn: (v: { id: string; approve: boolean }) => decideAccessRequest({ data: v }),
    onSuccess: (_r, v) => {
      toast.success(v.approve ? "Acesso aprovado" : "Solicitação recusada");
      qc.invalidateQueries({ queryKey: ["access-requests", projectId] });
      qc.invalidateQueries({ queryKey: ["members", projectId] });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const list = q.data ?? [];
  if (!list.length) return null;
  return (
    <Card className="border-amber-200 bg-amber-50/40">
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 text-amber-600" />
          Solicitações de acesso pendentes
          <Badge className="bg-amber-200 text-amber-900 hover:bg-amber-200 border-0">{list.length}</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {list.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg border bg-white px-4 py-3">
            <div className="min-w-0">
              <div className="text-sm font-medium truncate">{r.name || r.email || "Usuário"}</div>
              <div className="text-xs text-muted-foreground truncate">{r.email}</div>
              {r.message && <div className="mt-1 text-xs italic text-slate-600 line-clamp-2">"{r.message}"</div>}
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                size="sm" variant="outline"
                className="border-rose-300 text-rose-700 hover:bg-rose-50"
                onClick={() => decideM.mutate({ id: r.id, approve: false })}
                disabled={decideM.isPending}
              >
                <XCircle className="mr-1 h-4 w-4" /> Recusar
              </Button>
              <Button
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700"
                onClick={() => decideM.mutate({ id: r.id, approve: true })}
                disabled={decideM.isPending}
              >
                <CheckCircle2 className="mr-1 h-4 w-4" /> Aprovar
              </Button>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

