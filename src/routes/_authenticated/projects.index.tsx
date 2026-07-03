import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { Plus, Trash2, FileSpreadsheet, Upload, LogOut, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { supabase } from "@/integrations/supabase/client";
import { listProjects, createProject, deleteProject, importDraft } from "@/lib/tms.functions";

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
  const list = useServerFn(listProjects);
  const create = useServerFn(createProject);
  const del = useServerFn(deleteProject);
  const doImport = useServerFn(importDraft);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: projects, isPending } = useQuery({
    queryKey: ["projects"],
    queryFn: () => list(),
  });

  const [nome, setNome] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);

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

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-20 border-b bg-card/80 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground">
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

      <main className="mx-auto max-w-7xl px-6 py-8 space-y-6">
        <Card>
          <CardHeader><CardTitle>Novo projeto</CardTitle></CardHeader>
          <CardContent className="flex flex-wrap gap-2">
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

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {projects?.length === 0 && (
            <Card className="sm:col-span-2 lg:col-span-3">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Nenhum projeto ainda. Crie o primeiro acima.
              </CardContent>
            </Card>
          )}
          {projects?.map((p) => (
            <Card key={p.id} className="group hover:shadow-md transition">
              <CardHeader className="flex flex-row items-start justify-between space-y-0">
                <div>
                  <CardTitle className="text-base">{p.projeto || "(sem nome)"}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    v{p.versao || "—"} · {p.responsavel || "sem responsável"}
                  </p>
                </div>
                <Button variant="ghost" size="icon" onClick={() => setDelId(p.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">
                  {p.objetivo || "Sem objetivo definido."}
                </p>
                <Button asChild size="sm" variant="secondary" className="mt-3 w-full">
                  <Link to="/projects/$id" params={{ id: p.id }}>
                    Abrir <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>

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