import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  Plus, Trash2, FileSpreadsheet, Upload, LogOut, ArrowRight, KeyRound,
  Search, Users, Crown, Clock, Bell, Check, CheckCheck, Settings,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { createProject, deleteProject, importDraft, updateProjectTags } from "@/lib/tms.functions";
import {
  joinProjectByCode, listMyProjects, listNotifications, markNotificationsRead,
  type MyProjectSummary, type NotificationRow, type ProjectTag,
} from "@/lib/members.functions";

// Palette of pre-defined tag colors (Tailwind-based)
const TAG_COLORS: { name: string; label: string; bg: string; text: string; ring: string; dot: string }[] = [
  { name: "blue",   label: "Azul (Blue)",       bg: "bg-blue-100",   text: "text-blue-800",   ring: "ring-blue-300",   dot: "bg-blue-500" },
  { name: "green",  label: "Verde (Green)",     bg: "bg-green-100",  text: "text-green-800",  ring: "ring-green-300",  dot: "bg-green-500" },
  { name: "red",    label: "Vermelho (Red)",    bg: "bg-red-100",    text: "text-red-800",    ring: "ring-red-300",    dot: "bg-red-500" },
  { name: "yellow", label: "Amarelo (Yellow)",  bg: "bg-yellow-100", text: "text-yellow-800", ring: "ring-yellow-300", dot: "bg-yellow-500" },
  { name: "purple", label: "Roxo (Purple)",     bg: "bg-purple-100", text: "text-purple-800", ring: "ring-purple-300", dot: "bg-purple-500" },
  { name: "orange", label: "Laranja (Orange)",  bg: "bg-orange-100", text: "text-orange-800", ring: "ring-orange-300", dot: "bg-orange-500" },
  { name: "gray",   label: "Cinza (Gray)",      bg: "bg-slate-100",  text: "text-slate-700",  ring: "ring-slate-300",  dot: "bg-slate-500" },
];

function tagStyle(color: string) {
  return TAG_COLORS.find((c) => c.name === color) ?? TAG_COLORS[TAG_COLORS.length - 1];
}


const projectsQueryOptions = () => ({
  queryKey: ["my-projects"] as const,
  queryFn: () => listMyProjects(),
  staleTime: 5 * 60_000,
  gcTime: 15 * 60_000,
});

const notificationsQueryOptions = () => ({
  queryKey: ["notifications"] as const,
  queryFn: () => listNotifications(),
  staleTime: 60_000,
  refetchInterval: 60_000,
});

export const Route = createFileRoute("/_authenticated/projects/")({
  head: () => ({ meta: [{ title: "QualiDocs · Meus Projetos (My Projects)" }] }),
  loader: ({ context }) => context.queryClient.ensureQueryData(projectsQueryOptions()),
  component: DashboardPage,
  pendingComponent: ProjectsLoading,
  errorComponent: ProjectsRouteError,
  notFoundComponent: ProjectsNotFound,
});

function ProjectsLoading() {
  return (
    <div className="min-h-screen bg-slate-50/60 px-6 py-10">
      <div className="mx-auto max-w-7xl space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
        <Skeleton className="h-10 w-full" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}

function ProjectsRouteError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const message = error?.message || "Erro desconhecido";

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/60 px-4">
      <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">Erro ao renderizar seus projetos</h1>
        <p className="mt-2 text-sm text-muted-foreground">A tela de projetos encontrou uma falha ao carregar ou renderizar os dados.</p>
        <pre className="mt-4 max-h-44 overflow-auto rounded-lg bg-slate-50 p-3 text-left text-xs text-rose-700 whitespace-pre-wrap">
          {message}
        </pre>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button onClick={() => { router.invalidate(); reset(); }}>Tentar novamente</Button>
          <Button variant="outline" asChild><Link to="/auth">Ir para login</Link></Button>
        </div>
      </div>
    </div>
  );
}

function ProjectsNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/60 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight">Projetos não encontrados</h1>
        <p className="mt-2 text-sm text-muted-foreground">A rota solicitada não está disponível.</p>
        <Button className="mt-5" asChild><Link to="/projects">Voltar para projetos</Link></Button>
      </div>
    </div>
  );
}

function readLocalDraft() {
  try {
    const raw = localStorage.getItem("citse-qa-data-v1");
    if (!raw || raw === "undefined" || raw === "null" || raw.length <= 20) return null;
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem("citse-qa-data-v1");
    return null;
  }
}

function fmt(d: string) {
  try { return formatDistanceToNow(new Date(d), { addSuffix: true, locale: ptBR }); }
  catch { return d; }
}

function roleLabel(r: MyProjectSummary["my_role"]) {
  return r === "owner" ? "Proprietário (Owner)"
    : r === "admin" ? "Administrador (Admin)"
    : r === "collaborator" ? "Colaborador (Collaborator)"
    : "Visualizador (Viewer)";
}


function DashboardPage() {
  const create = useServerFn(createProject);
  const del = useServerFn(deleteProject);
  const doImport = useServerFn(importDraft);
  const join = useServerFn(joinProjectByCode);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isPending } = useQuery(projectsQueryOptions());

  const [newProjOpen, setNewProjOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [delId, setDelId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [q, setQ] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? null));
    setHasDraft(!!readLocalDraft());
  }, []);

  const createM = useMutation({
    mutationFn: (name: string) => create({ data: { projeto: name } }),
    onSuccess: (row) => {
      toast.success("Projeto criado");
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      setNewProjOpen(false); setNome("");
      navigate({ to: "/projects/$id", params: { id: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delM = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success("Projeto excluído");
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      setDelId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const importM = useMutation({
    mutationFn: async () => {
      const d = readLocalDraft();
      if (!d) throw new Error("Nenhum rascunho local encontrado.");
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
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      navigate({ to: "/projects/$id", params: { id: res.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const joinM = useMutation({
    mutationFn: (code: string) => join({ data: { code } }),
    onSuccess: (res) => {
      setJoinOpen(false);
      setJoinCode("");
      if (res.already_member) {
        toast.success("Você já é membro desse projeto");
        qc.invalidateQueries({ queryKey: ["my-projects"] });
        navigate({ to: "/projects/$id", params: { id: res.project_id } });
      } else {
        toast.success("Solicitação enviada! Aguarde a aprovação do proprietário.");
        qc.invalidateQueries({ queryKey: ["notifications"] });
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  if (isPending || !data || !Array.isArray(data.owned) || !Array.isArray(data.collaborating)) {
    return <ProjectsLoading />;
  }

  const owned = data.owned.filter(Boolean);
  const collab = data.collaborating.filter(Boolean);
  const query = q.trim().toLowerCase();
  const filter = (p: MyProjectSummary) => {
    const name = p?.projeto?.toLowerCase?.() ?? "";
    const owner = p?.owner_name?.toLowerCase?.() ?? "";
    return !query || name.includes(query) || owner.includes(query);
  };
  const ownedF = owned.filter(filter);
  const collabF = collab.filter(filter);

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
              <h1 className="text-lg font-semibold tracking-tight">QualiDocs · Meus Projetos</h1>
              <p className="text-xs text-muted-foreground">{email}</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            <NotificationsBell />
            <Button variant="ghost" size="sm" asChild title="Minha conta">
              <Link to="/account"><Settings className="h-4 w-4" /></Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-10 space-y-10">
        {/* Toolbar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Pesquisar projeto ou proprietário…"
              className="pl-9 h-10 rounded-lg bg-white"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setJoinOpen(true)}
            className="h-10 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <KeyRound className="mr-2 h-4 w-4" /> Entrar em um projeto
          </Button>
          {hasDraft && (
            <Button variant="outline" onClick={() => importM.mutate()} disabled={importM.isPending} className="h-10">
              <Upload className="mr-2 h-4 w-4" /> Importar rascunho
            </Button>
          )}
          <Button onClick={() => setNewProjOpen(true)} className="h-10">
            <Plus className="mr-2 h-4 w-4" /> Novo projeto
          </Button>
        </div>

        {/* Meus Projetos */}
        <section className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" /> Meus projetos
            </h2>
            <span className="text-xs text-muted-foreground">{ownedF.length}</span>
          </div>
          {isPending && <p className="text-sm text-muted-foreground">Carregando…</p>}
          {!isPending && ownedF.length === 0 && (
            <Card className="rounded-xl border-dashed border-slate-300 bg-white">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Você ainda não criou nenhum projeto. Clique em <b>Novo projeto</b> para começar.
              </CardContent>
            </Card>
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ownedF.map((p) => <OwnerCard key={p.id} p={p} onDelete={setDelId} />)}
          </div>
        </section>

        {/* Colaboro */}
        <section className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Projetos em que colaboro
            </h2>
            <span className="text-xs text-muted-foreground">{collabF.length}</span>
          </div>
          {!isPending && collabF.length === 0 && (
            <Card className="rounded-xl border-dashed border-slate-300 bg-white">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Você ainda não colabora em nenhum projeto. Use um código de acesso ou aceite um convite para entrar.
              </CardContent>
            </Card>
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {collabF.map((p) => <CollabCard key={p.id} p={p} />)}
          </div>
        </section>
      </main>

      {/* Novo projeto */}
      <Dialog open={newProjOpen} onOpenChange={setNewProjOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo projeto</DialogTitle>
            <DialogDescription>Dê um nome ao seu projeto. Você poderá configurar tudo mais depois.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">Nome do projeto</Label>
            <Input
              autoFocus
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex.: Plataforma QualiDocs — Onboarding"
              onKeyDown={(e) => { if (e.key === "Enter" && nome.trim()) createM.mutate(nome.trim()); }}
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewProjOpen(false)}>Cancelar</Button>
            <Button onClick={() => nome.trim() && createM.mutate(nome.trim())} disabled={createM.isPending || !nome.trim()}>
              <Plus className="mr-2 h-4 w-4" /> Criar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Join code */}
      <Dialog open={joinOpen} onOpenChange={(o) => { setJoinOpen(o); if (!o) setJoinCode(""); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Entrar em um projeto</DialogTitle>
            <DialogDescription>
              Digite o código de acesso (ex.: <span className="font-mono">CTS-89F</span>). O proprietário receberá uma solicitação para aprovar seu acesso.
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
              <ArrowRight className="mr-2 h-4 w-4" /> Solicitar acesso
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete */}
      <AlertDialog open={!!delId} onOpenChange={(o) => !o && setDelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir projeto?</AlertDialogTitle>
            <AlertDialogDescription>
              Todos os dados relacionados (user stories, casos de teste, bugs, auditoria, membros) serão removidos.
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

function OwnerCard({ p, onDelete }: { p: MyProjectSummary; onDelete: (id: string) => void }) {
  const id = p?.id ?? "";
  return (
    <Card className="group rounded-2xl border-slate-200/70 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0"><Crown className="h-3 w-3 mr-1" /> Proprietário</Badge>
            {(p?.pending_requests ?? 0) > 0 && (
              <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-0">
                {(p?.pending_requests ?? 0)} solicitação{(p?.pending_requests ?? 0) > 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <CardTitle className="mt-2 text-base truncate">{p?.projeto || "(sem nome)"}</CardTitle>
        </div>
        <Button variant="ghost" size="icon" onClick={() => id && onDelete(id)} className="text-muted-foreground hover:text-destructive shrink-0">
          <Trash2 className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{p?.objetivo || "Sem objetivo definido."}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {(p?.member_count ?? 0)} {(p?.member_count ?? 0) === 1 ? "membro" : "membros"}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmt(p?.updated_at ?? "")}</span>
        </div>
        {p?.codigo_acesso && (
          <div className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-1 font-mono text-[11px] text-slate-600">
            <KeyRound className="h-3 w-3" /> {p?.codigo_acesso}
          </div>
        )}
        <Button asChild size="sm" className="w-full rounded-lg">
          <Link to="/projects/$id" params={{ id }}>Entrar <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function CollabCard({ p }: { p: MyProjectSummary }) {
  const id = p?.id ?? "";
  return (
    <Card className="group rounded-2xl border-slate-200/70 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10 border-0">{roleLabel(p?.my_role ?? "viewer")}</Badge>
        </div>
        <CardTitle className="mt-2 text-base truncate">{p?.projeto || "(sem nome)"}</CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          <Crown className="inline h-3 w-3 text-amber-500 mr-1" /> {p?.owner_name || "Proprietário"}
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{p?.objetivo || "Sem descrição."}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {(p?.member_count ?? 0)}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmt(p?.updated_at ?? "")}</span>
        </div>
        <Button asChild size="sm" variant="secondary" className="w-full rounded-lg">
          <Link to="/projects/$id" params={{ id }}>Entrar <ArrowRight className="ml-2 h-4 w-4" /></Link>
        </Button>
      </CardContent>
    </Card>
  );
}

function notificationText(n: NotificationRow): string {
  const actor = n?.actor_name || "Alguém";
  const proj = n?.project_name ?? "um projeto";
  switch (n?.type) {
    case "access_request": return `${actor} solicitou acesso ao projeto "${proj}".`;
    case "access_approved": return `Seu acesso ao projeto "${proj}" foi aprovado.`;
    case "access_rejected": return `Seu acesso ao projeto "${proj}" foi recusado.`;
    case "invitation_accepted": return `${actor} aceitou o convite para "${proj}".`;
    default: return `Nova atualização em "${proj}".`;
  }
}

function NotificationsBell() {
  const qc = useQueryClient();
  const { data } = useQuery(notificationsQueryOptions());
  const markRead = useServerFn(markNotificationsRead);
  const [open, setOpen] = useState(false);
  const notifs = Array.isArray(data) ? data.filter(Boolean) : [];
  const unread = notifs.filter((n) => !n?.read_at).length;

  const markAll = useMutation({
    mutationFn: () => markRead({ data: {} }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  return (
    <Popover open={open} onOpenChange={(o) => {
      setOpen(o);
      if (o && unread > 0) markAll.mutate();
    }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute top-1.5 right-1.5 h-4 min-w-[16px] rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white flex items-center justify-center">
              {unread > 9 ? "9+" : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <div className="text-sm font-semibold">Notificações</div>
          {unread > 0 && (
            <button
              onClick={() => markAll.mutate()}
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              <CheckCheck className="h-3 w-3" /> Marcar tudo como lido
            </button>
          )}
        </div>
        <div className="max-h-[420px] overflow-y-auto divide-y">
          {notifs.length === 0 && (
            <div className="p-6 text-center text-xs text-muted-foreground">Nenhuma notificação por aqui.</div>
          )}
          {notifs.map((n) => {
            const inner = (
              <div className="flex items-start gap-3">
                <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${n?.read_at ? "bg-slate-300" : "bg-primary"}`} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">{notificationText(n)}</p>
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{fmt(n?.created_at)}</p>
                </div>
                {n?.read_at && <Check className="h-3.5 w-3.5 text-slate-300 shrink-0" />}
              </div>
            );
            if (n?.project_id) {
              return (
                <Link
                  key={n?.id}
                  to="/projects/$id"
                  params={{ id: n?.project_id }}
                  onClick={() => setOpen(false)}
                  className="block px-4 py-3 hover:bg-slate-50"
                >
                  {inner}
                </Link>
              );
            }
            return <div key={n?.id} className="px-4 py-3">{inner}</div>;
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
