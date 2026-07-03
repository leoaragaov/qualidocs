import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { Plus, Trash2, FileSpreadsheet, Upload, LogOut, ArrowRight, KeyRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { listProjects, createProject, deleteProject, importDraft } from "@/lib/tms.functions";
import { joinProjectByCode } from "@/lib/members.functions";

const projectsQueryOptions = () => ({
  queryKey: ["projects"] as const,
  queryFn: () => listProjects(),
  staleTime: 30_000,
});

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [{ title: "Meus Projetos · Citse QA" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQueryOptions()),
  component: DashboardPage,
});

function DashboardPage() {
  const create = useServerFn(createProject);
  const del = useServerFn(deleteProject);
  const doImport = useServerFn(importDraft);
  const join = useServerFn(joinProjectByCode);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: projects, isPending } = useQuery(projectsQueryOptions());

  const [nome, setNome] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
    try {
      const raw = localStorage.getItem("citse-qa-data-v1");
      setHasDraft(!!raw && raw.length > 20);
    } catch { /* ignore */ }
  }, []);

  const createM = useMutation({
    mutationFn: (name: string) => create({ data: { projeto: name } }),
    onSuccess: (row) => {
      toast.success("Projeto criado");
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/projects/$id", params: { id: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Projeto excluído");
      qc.invalidateQueries({ queryKey: ["projects"] });
      setDelId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importM = useMutation({
    mutationFn: async () => {
      const raw = localStorage.getItem("citse-qa-data-v1");
      if (!raw) throw new Error("Nenhum rascunho local encontrado.");
      const d = JSON.parse(raw);
      return doImport({
        data: {
          projeto: d.plano?.projeto ?? "",
          versao: d.plano?.versao ?? "",
          responsavel: d.plano?.responsavel ?? "",
          ambiente: d.plano?.ambiente ?? "",
          data_criacao: d.plano?.dataCriacao || null,
          ultima_revisao: d.plano?.ultimaRevisao || null,
          objetivo: d.plano?.objetivo ?? "",
          in_scope: d.plano?.inScope ?? "",
          out_of_scope: d.plano?.outOfScope ?? "",
          cronograma: d.plano?.cronograma ?? [],
          riscos: d.plano?.riscos ?? [],
          userStories: d.userStories ?? [],
          casosTeste: d.casosTeste ?? [],
        },
      });
    },
    onSuccess: (res) => {
      toast.success("Rascunho importado!");
      try { localStorage.removeItem("citse-qa-data-v1"); } catch { /* ignore */ }
      setHasDraft(false);
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/projects/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const joinM = useMutation({
    mutationFn: (code: string) => join({ data: { code } }),
    onSuccess: (res) => {
      toast.success("Você entrou no projeto!");
      setJoinOpen(false);
      setJoinCode("");
      qc.invalidateQueries({ queryKey: ["projects"] });
      navigate({ to: "/projects/$id", params: { id: res.project_id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-slate-50/60">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-sm">
              <FileSpreadsheet className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-tight">Citse · Meus Projetos</h1>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={signOut}>
            <LogOut className="mr-2 h-4 w-4" /> Sair
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-8">
        <Card className="rounded-xl border-slate-200/70 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <CardTitle className="text-lg">Novo projeto</CardTitle>
              <Button
                variant="outline"
                onClick={() => setJoinOpen(true)}
                className="border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
              >
                <KeyRound className="mr-2 h-4 w-4" /> Entrar em um Projeto
              </Button>
            </div>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[240px] space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome do projeto</Label>
              <Input
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Plataforma Citse — Onboarding"
                onKeyDown={(e) => { if (e.key === "Enter" && nome.trim()) createM.mutate(nome.trim()); }}
              />
            </div>
            <div className="flex items-end gap-2">
              <Button onClick={() => nome.trim() && createM.mutate(nome.trim())} disabled={createM.isPending || !nome.trim()}>
                <Plus className="mr-2 h-4 w-4" /> Criar projeto
              </Button>
              {hasDraft && (
                <Button variant="outline" onClick={() => importM.mutate()} disabled={importM.isPending}>
                  <Upload className="mr-2 h-4 w-4" /> Importar rascunho local
                </Button>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {projects?.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3 rounded-xl border-dashed border-slate-300 bg-white">
              <CardContent className="py-14 text-center text-sm text-muted-foreground">
                Nenhum projeto ainda. Crie o primeiro acima ou entre em um usando um código de acesso.
              </CardContent>
            </Card>
          )}
          {projects?.map((p) => (
            <Card key={p.id} className="group rounded-xl border-slate-200/70 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all">
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
                <div className="min-w-0">
                  <CardTitle className="text-base truncate">{p.projeto || "(sem nome)"}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    v{p.versao || "—"} · {p.responsavel || "sem responsável"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDelId(p.id)} className="text-muted-foreground hover:text-destructive">
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent className="pt-0">
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                  {p.objetivo || "Sem objetivo definido."}
                </p>
                {p.codigo_acesso && (
                  <div className="mt-3 inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
                    <KeyRound className="h-3 w-3" /> {p.codigo_acesso}
                  </div>
                )}
                <Button asChild size="sm" variant="secondary" className="mt-4 w-full rounded-lg">
                  <Link to="/projects/$id" params={{ id: p.id }}>
                    Abrir <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

      <Dialog open={joinOpen} onOpenChange={(o) => { setJoinOpen(o); if (!o) setJoinCode(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Entrar em um projeto</DialogTitle>
            <DialogDescription>
              Digite o código de acesso do projeto (ex.: <span className="font-mono">CTS-89F</span>) para virar colaborador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label className="text-xs text-muted-foreground">Código de acesso</Label>
            <Input
              autoFocus
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              placeholder="CTS-XXX"
              className="font-mono tracking-wider uppercase"
              onKeyDown={(e) => { if (e.key === "Enter" && joinCode.trim()) joinM.mutate(joinCode.trim()); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setJoinOpen(false)}>Cancelar</Button>
            <Button onClick={() => joinCode.trim() && joinM.mutate(joinCode.trim())} disabled={joinM.isPending || !joinCode.trim()}>
              <ArrowRight className="mr-2 h-4 w-4" /> Entrar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os dados relacionados (user stories, casos de teste, bugs, auditoria) serão removidos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => delId && delM.mutate(delId)}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
// Suppress unused-var warnings for Copy (kept for future use in this file).
export const __copyIcon = Copy;