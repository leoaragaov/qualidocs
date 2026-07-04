import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  Plus, Trash2, FileSpreadsheet, Upload, LogOut, ArrowRight, KeyRound,
  Search, Users, Crown, Clock, Bell, Check, CheckCheck, Settings, Tag, X, Pencil,
} from "lucide-react";

import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import {
  createGlobalProjectTag, createProject, deleteGlobalProjectTag, deleteProject, importDraft,
  listGlobalProjectTags, updateGlobalProjectTag, updateProjectTags, type GlobalProjectTag,
} from "@/lib/tms.functions";
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

const globalTagsQueryOptions = () => ({
  queryKey: ["global-project-tags"] as const,
  queryFn: () => listGlobalProjectTags(),
  staleTime: 5 * 60_000,
  gcTime: 15 * 60_000,
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
  const saveTags = useServerFn(updateProjectTags);
  const createGlobalTag = useServerFn(createGlobalProjectTag);
  const updateGlobalTag = useServerFn(updateGlobalProjectTag);
  const deleteGlobalTag = useServerFn(deleteGlobalProjectTag);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data, isPending } = useQuery(projectsQueryOptions());
  const { data: globalTagsData = [] } = useQuery(globalTagsQueryOptions());
  const globalTags = Array.isArray(globalTagsData) ? globalTagsData : [];

  const [newProjOpen, setNewProjOpen] = useState(false);
  const [nome, setNome] = useState("");
  const [newTagIds, setNewTagIds] = useState<string[]>([]);
  const [delId, setDelId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [hasDraft, setHasDraft] = useState(false);
  const [joinOpen, setJoinOpen] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [q, setQ] = useState("");
  const [tagsEdit, setTagsEdit] = useState<{ id: string; name: string; tagIds: string[] } | null>(null);
  const [globalTagsOpen, setGlobalTagsOpen] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user?.email ?? null));
    setHasDraft(!!readLocalDraft());
  }, []);

  const createM = useMutation({
    mutationFn: (payload: { name: string; tagIds: string[] }) =>
      create({ data: { projeto: payload.name, tagIds: payload.tagIds } }),
    onSuccess: (row) => {
      toast.success("Projeto criado (Project created)");
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      setNewProjOpen(false); setNome(""); setNewTagIds([]);
      navigate({ to: "/projects/$id", params: { id: row.id } });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const tagsM = useMutation({
    mutationFn: (payload: { id: string; tagIds: string[] }) => saveTags({ data: payload }),
    onSuccess: (res, vars) => {
      toast.success("Tags atualizadas (Tags updated)");
      qc.setQueryData(projectsQueryOptions().queryKey, (old: { owned: MyProjectSummary[]; collaborating: MyProjectSummary[] } | undefined) => {
        if (!old) return old;
        const apply = (projects: MyProjectSummary[]) => projects.map((project) => (
          project.id === vars.id ? { ...project, tags: (res.tags ?? []) as ProjectTag[] } : project
        ));
        return { owned: apply(old.owned), collaborating: apply(old.collaborating) };
      });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
      setTagsEdit(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const createGlobalTagM = useMutation({
    mutationFn: (payload: { name: string; color: string }) => createGlobalTag({ data: payload }),
    onSuccess: (tag) => {
      toast.success("Tag criada (Tag created)");
      qc.setQueryData(globalTagsQueryOptions().queryKey, (old: GlobalProjectTag[] | undefined) => [...(old ?? []), tag]);
      qc.invalidateQueries({ queryKey: ["global-project-tags"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateGlobalTagM = useMutation({
    mutationFn: (payload: { id: string; name: string; color: string }) => updateGlobalTag({ data: payload }),
    onSuccess: (tag) => {
      toast.success("Tag atualizada (Tag updated)");
      qc.setQueryData(globalTagsQueryOptions().queryKey, (old: GlobalProjectTag[] | undefined) => (
        (old ?? []).map((item) => (item.id === tag.id ? tag : item))
      ));
      qc.setQueryData(projectsQueryOptions().queryKey, (old: { owned: MyProjectSummary[]; collaborating: MyProjectSummary[] } | undefined) => {
        if (!old) return old;
        const apply = (projects: MyProjectSummary[]) => projects.map((project) => ({
          ...project,
          tags: project.tags.map((item) => (item.id === tag.id ? { id: tag.id, name: tag.name, color: tag.color } : item)),
        }));
        return { owned: apply(old.owned), collaborating: apply(old.collaborating) };
      });
      qc.invalidateQueries({ queryKey: ["global-project-tags"] });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteGlobalTagM = useMutation({
    mutationFn: (id: string) => deleteGlobalTag({ data: { id } }),
    onSuccess: (_res, id) => {
      toast.success("Tag excluída (Tag deleted)");
      setNewTagIds((current) => current.filter((tagId) => tagId !== id));
      setTagsEdit((current) => current ? { ...current, tagIds: current.tagIds.filter((tagId) => tagId !== id) } : current);
      qc.setQueryData(globalTagsQueryOptions().queryKey, (old: GlobalProjectTag[] | undefined) => (
        (old ?? []).filter((tag) => tag.id !== id)
      ));
      qc.setQueryData(projectsQueryOptions().queryKey, (old: { owned: MyProjectSummary[]; collaborating: MyProjectSummary[] } | undefined) => {
        if (!old) return old;
        const apply = (projects: MyProjectSummary[]) => projects.map((project) => ({
          ...project,
          tags: project.tags.filter((tag) => tag.id !== id),
        }));
        return { owned: apply(old.owned), collaborating: apply(old.collaborating) };
      });
      qc.invalidateQueries({ queryKey: ["global-project-tags"] });
      qc.invalidateQueries({ queryKey: ["my-projects"] });
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
              <h1 className="text-lg font-semibold tracking-tight">QualiDocs · Meus Projetos (My Projects)</h1>
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
              placeholder="Pesquisar projeto ou proprietário... (Search project or owner...)"
              className="pl-9 h-10 rounded-lg bg-white"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setJoinOpen(true)}
            className="h-10 border-primary/30 bg-primary/5 text-primary hover:bg-primary/10 hover:text-primary"
          >
            <KeyRound className="mr-2 h-4 w-4" /> Entrar em um projeto (Enter a project)
          </Button>
          {hasDraft && (
            <Button variant="outline" onClick={() => importM.mutate()} disabled={importM.isPending} className="h-10">
              <Upload className="mr-2 h-4 w-4" /> Importar rascunho (Import draft)
            </Button>
          )}
          <Button variant="outline" onClick={() => setGlobalTagsOpen(true)} className="h-10">
            <Tag className="mr-2 h-4 w-4" /> Gerenciar Tags Globais (Manage Global Tags)
          </Button>
          <Button onClick={() => setNewProjOpen(true)} className="h-10">
            <Plus className="mr-2 h-4 w-4" /> Novo projeto (New project)
          </Button>
        </div>

        {/* Meus Projetos */}
        <section className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Crown className="h-4 w-4 text-amber-500" /> Meus Projetos (My Projects)
            </h2>
            <span className="text-xs text-muted-foreground">{ownedF.length}</span>
          </div>
          {isPending && <p className="text-sm text-muted-foreground">Carregando… (Loading…)</p>}
          {!isPending && ownedF.length === 0 && (
            <Card className="rounded-xl border-dashed border-slate-300 bg-white">
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                Você ainda não criou nenhum projeto. Clique em <b>Novo projeto (New project)</b> para começar.
              </CardContent>
            </Card>
          )}
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {ownedF.map((p) => (
              <OwnerCard
                key={p.id}
                p={p}
                onDelete={setDelId}
                onEditTags={() => setTagsEdit({ id: p.id, name: p.projeto, tagIds: (p.tags ?? []).map((tag) => tag.id) })}
              />
            ))}
          </div>
        </section>

        {/* Colaboro */}
        <section className="space-y-4">
          <div className="flex items-baseline gap-3">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" /> Projetos em que Colaboro (Projects I Collaborate On)

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
      <Dialog open={newProjOpen} onOpenChange={(o) => { setNewProjOpen(o); if (!o) { setNome(""); setNewTagIds([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo projeto (New Project)</DialogTitle>
            <DialogDescription>Dê um nome ao seu projeto e adicione tags. Você poderá configurar tudo mais depois.</DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nome do projeto (Project Name)</Label>
              <Input
                autoFocus
                value={nome}
                onChange={(e) => setNome(e.target.value)}
                placeholder="Ex.: Plataforma QualiDocs — Onboarding"
              />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1"><Tag className="h-3.5 w-3.5" /> Tags do Projeto (Project Tags)</Label>
                <Button type="button" size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={() => setGlobalTagsOpen(true)}>
                  Gerenciar Tags Globais (Manage Global Tags)
                </Button>
              </div>
              <ProjectTagSelector
                tags={globalTags}
                selectedIds={newTagIds}
                onChange={setNewTagIds}
                onManageGlobal={() => setGlobalTagsOpen(true)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNewProjOpen(false)}>Cancelar (Cancel)</Button>
            <Button
              onClick={() => nome.trim() && createM.mutate({
                name: nome.trim(),
                tagIds: newTagIds.filter((id) => globalTags.some((tag) => tag.id === id)),
              })}
              disabled={createM.isPending || !nome.trim()}
            >
              <Plus className="mr-2 h-4 w-4" /> Criar (Create)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Editar Tags */}
      <Dialog open={!!tagsEdit} onOpenChange={(o) => !o && setTagsEdit(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> Gerenciar Tags do Projeto (Manage Project Tags)</DialogTitle>
            <DialogDescription>{tagsEdit?.name}</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            {tagsEdit && (
              <ProjectTagSelector
                tags={globalTags}
                selectedIds={tagsEdit.tagIds}
                onChange={(tagIds) => setTagsEdit((prev) => (prev ? { ...prev, tagIds } : prev))}
                onManageGlobal={() => setGlobalTagsOpen(true)}
              />
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setTagsEdit(null)}>Cancelar (Cancel)</Button>
            <Button
              onClick={() => tagsEdit && tagsM.mutate({
                id: tagsEdit.id,
                tagIds: tagsEdit.tagIds.filter((id) => globalTags.some((tag) => tag.id === id)),
              })}
              disabled={tagsM.isPending}
            >
              <Check className="mr-2 h-4 w-4" /> Salvar (Save)
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Gerenciar Tags Globais */}
      <GlobalTagsDialog
        open={globalTagsOpen}
        onOpenChange={setGlobalTagsOpen}
        tags={globalTags}
        onCreate={(payload) => createGlobalTagM.mutate(payload)}
        onUpdate={(payload) => updateGlobalTagM.mutate(payload)}
        onDelete={(id) => deleteGlobalTagM.mutate(id)}
        busy={createGlobalTagM.isPending || updateGlobalTagM.isPending || deleteGlobalTagM.isPending}
      />


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

function TagBadges({ tags }: { tags: ProjectTag[] }) {
  if (!tags || tags.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {tags.map((t, i) => {
        const s = tagStyle(t.color);
        return (
          <span
            key={t.id || `${t.name}-${i}`}
            className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${s.bg} ${s.text}`}
          >
            {t.name}
          </span>
        );
      })}
    </div>
  );
}

function ProjectTagSelector({
  tags,
  selectedIds,
  onChange,
  onManageGlobal,
}: {
  tags: GlobalProjectTag[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  onManageGlobal: () => void;
}) {
  function toggle(id: string, checked: boolean) {
    const current = new Set(selectedIds);
    if (checked) current.add(id);
    else current.delete(id);
    onChange(Array.from(current));
  }

  if (tags.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/70 p-4 text-center">
        <p className="text-xs text-muted-foreground">Nenhuma tag global criada (No global tags created)</p>
        <Button type="button" variant="outline" size="sm" className="mt-3" onClick={onManageGlobal}>
          <Plus className="mr-2 h-4 w-4" /> Criar Tag Global (Create Global Tag)
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="max-h-64 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
        {tags.map((tag) => {
          const style = tagStyle(tag.color);
          const checked = selectedIds.includes(tag.id);
          return (
            <label
              key={tag.id}
              className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 hover:bg-slate-50"
            >
              <Checkbox checked={checked} onCheckedChange={(value) => toggle(tag.id, value === true)} />
              <span className={`inline-flex min-w-0 flex-1 items-center rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                <span className="truncate">{tag.name}</span>
              </span>
            </label>
          );
        })}
      </div>
      <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={onManageGlobal}>
        <Settings className="mr-2 h-3.5 w-3.5" /> Gerenciar Tags Globais (Manage Global Tags)
      </Button>
    </div>
  );
}

function GlobalTagsDialog({
  open,
  onOpenChange,
  tags,
  onCreate,
  onUpdate,
  onDelete,
  busy,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tags: GlobalProjectTag[];
  onCreate: (payload: { name: string; color: string }) => void;
  onUpdate: (payload: { id: string; name: string; color: string }) => void;
  onDelete: (id: string) => void;
  busy: boolean;
}) {
  const [name, setName] = useState("");
  const [color, setColor] = useState<string>(TAG_COLORS[0].name);
  const [editing, setEditing] = useState<{ id: string; name: string; color: string } | null>(null);

  function createTag() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onCreate({ name: trimmed, color });
    setName("");
  }

  function startEdit(tag: GlobalProjectTag) {
    setEditing({ id: tag.id, name: tag.name, color: tag.color });
  }

  function saveEdit() {
    if (!editing?.name.trim()) return;
    onUpdate({ id: editing.id, name: editing.name.trim(), color: editing.color });
    setEditing(null);
  }

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setEditing(null); }}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Tag className="h-4 w-4" /> Gerenciar Tags Globais (Manage Global Tags)</DialogTitle>
          <DialogDescription>Crie, edite ou exclua tags reutilizáveis dos projetos (Create, edit, or delete reusable project tags).</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="rounded-lg border border-slate-200 bg-slate-50/70 p-3 space-y-3">
            <Label className="text-xs text-muted-foreground">Nova Tag Global (New Global Tag)</Label>
            <div className="flex items-center gap-2">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); createTag(); } }}
                placeholder="Nome da tag (Tag name)"
                className="h-9 flex-1 bg-white"
                maxLength={40}
              />
              <Button type="button" size="sm" onClick={createTag} disabled={busy || !name.trim()}>
                <Plus className="mr-2 h-4 w-4" /> Criar (Create)
              </Button>
            </div>
            <ColorPicker value={color} onChange={setColor} />
          </div>

          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Tags Existentes (Existing Tags)</Label>
            <div className="max-h-72 space-y-2 overflow-y-auto rounded-lg border border-slate-200 bg-white p-2">
              {tags.length === 0 && (
                <div className="py-6 text-center text-xs text-muted-foreground">Nenhuma tag cadastrada (No tags registered)</div>
              )}
              {tags.map((tag) => {
                const style = tagStyle(tag.color);
                const isEditing = editing?.id === tag.id;
                return (
                  <div key={tag.id} className="rounded-md border border-slate-100 p-2">
                    {isEditing ? (
                      <div className="space-y-2">
                        <Input
                          value={editing.name}
                          onChange={(e) => setEditing({ ...editing, name: e.target.value })}
                          placeholder="Nome da tag (Tag name)"
                          className="h-9"
                          maxLength={40}
                        />
                        <ColorPicker value={editing.color} onChange={(next) => setEditing({ ...editing, color: next })} />
                        <div className="flex justify-end gap-2">
                          <Button type="button" size="sm" variant="ghost" onClick={() => setEditing(null)}>Cancelar (Cancel)</Button>
                          <Button type="button" size="sm" onClick={saveEdit} disabled={busy || !editing.name.trim()}>
                            <Check className="mr-2 h-4 w-4" /> Salvar (Save)
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className={`min-w-0 flex-1 rounded-full px-2.5 py-1 text-xs font-medium ${style.bg} ${style.text}`}>
                          <span className="block truncate">{tag.name}</span>
                        </span>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => startEdit(tag)} title="Editar Tag (Edit Tag)">
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-destructive" onClick={() => onDelete(tag.id)} title="Excluir Tag (Delete Tag)" disabled={busy}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar (Close)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ColorPicker({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {TAG_COLORS.map((c) => (
        <button
          key={c.name}
          type="button"
          title={c.label}
          onClick={() => onChange(c.name)}
          className={`h-6 w-6 rounded-full ${c.dot} ring-2 ring-offset-1 transition ${value === c.name ? "ring-slate-800" : "ring-transparent"}`}
        />
      ))}
    </div>
  );
}

function OwnerCard({ p, onDelete, onEditTags }: { p: MyProjectSummary; onDelete: (id: string) => void; onEditTags: () => void }) {
  const id = p?.id ?? "";
  return (
    <Card className="group rounded-2xl border-slate-200/70 bg-white shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-200">
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-0"><Crown className="h-3 w-3 mr-1" /> Proprietário (Owner)</Badge>
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
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {p?.tags && p.tags.length > 0 ? (
              <TagBadges tags={p.tags} />
            ) : (
              <span className="text-[11px] text-muted-foreground italic">Sem tags (No tags)</span>
            )}
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={onEditTags}
            title="Editar tags (Edit tags)"
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button asChild size="sm" className="w-full rounded-lg">
          <Link to="/projects/$id" params={{ id }}>Entrar (Enter) <ArrowRight className="ml-2 h-4 w-4" /></Link>
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
          <Crown className="inline h-3 w-3 text-amber-500 mr-1" /> Proprietário (Owner): {p?.owner_name || "—"}
        </p>
      </CardHeader>
      <CardContent className="pt-0 space-y-3">
        <p className="text-xs text-muted-foreground line-clamp-2 min-h-[2rem]">{p?.objetivo || "Sem descrição."}</p>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1"><Users className="h-3.5 w-3.5" /> {(p?.member_count ?? 0)}</span>
          <span className="inline-flex items-center gap-1"><Clock className="h-3.5 w-3.5" /> {fmt(p?.updated_at ?? "")}</span>
        </div>
        {p?.tags && p.tags.length > 0 && <TagBadges tags={p.tags} />}
        <Button asChild size="sm" variant="secondary" className="w-full rounded-lg">
          <Link to="/projects/$id" params={{ id }}>Entrar (Enter) <ArrowRight className="ml-2 h-4 w-4" /></Link>
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
