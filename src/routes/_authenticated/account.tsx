import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast, Toaster } from "sonner";
import { ArrowLeft, KeyRound, ShieldAlert, Trash2, Loader2, UserCircle2, History, MapPin, Globe2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle,
  AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { deleteMyAccount } from "@/lib/account.functions";
import { listAccessHistory } from "@/lib/access-history.functions";

export const Route = createFileRoute("/_authenticated/account")({
  head: () => ({ meta: [{ title: "Minha Conta · QualiDocs" }] }),
  component: AccountPage,
});

function AccountPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const doDelete = useServerFn(deleteMyAccount);

  const [email, setEmail] = useState<string | null>(null);
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  async function handleChangePassword() {
    if (next.length < 6) return toast.error("A nova senha precisa ter no mínimo 6 caracteres.");
    if (next !== confirm) return toast.error("As senhas não conferem.");
    if (!email) return toast.error("Sessão inválida. Faça login novamente.");
    setSavingPwd(true);
    try {
      // Reautentica com senha atual para confirmar identidade
      const { error: signErr } = await supabase.auth.signInWithPassword({ email, password: current });
      if (signErr) {
        toast.error("Senha atual incorreta.");
        return;
      }
      const { error } = await supabase.auth.updateUser({ password: next });
      if (error) {
        console.error("[QualiDocs] Alterar senha:", error);
        toast.error(error.message);
        return;
      }
      toast.success("Senha alterada com sucesso!");
      setCurrent(""); setNext(""); setConfirm("");
    } finally {
      setSavingPwd(false);
    }
  }

  const deleteM = useMutation({
    mutationFn: () => doDelete({}),
    onSuccess: async () => {
      toast.success("Conta excluída. Sentiremos sua falta!");
      await qc.cancelQueries();
      qc.clear();
      await supabase.auth.signOut();
      navigate({ to: "/auth", replace: true });
    },
    onError: (e: Error) => {
      console.error("[QualiDocs] Excluir conta:", e);
      toast.error(e.message || "Falha ao excluir a conta.");
    },
  });

  return (
    <div className="min-h-screen bg-slate-50/60">
      <Toaster richColors position="top-right" />
      <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/projects"><ArrowLeft className="mr-1 h-4 w-4" /> Projetos</Link>
          </Button>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <UserCircle2 className="h-4 w-4" /> Minha Conta
          </div>
          <span className="w-16" />
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-10 space-y-6">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base">Informações da conta</CardTitle>
            <CardDescription>{email ?? "…"}</CardDescription>
          </CardHeader>
        </Card>

        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <KeyRound className="h-4 w-4" /> Alterar senha
            </CardTitle>
            <CardDescription>Confirme sua senha atual para definir uma nova.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Senha atual</Label>
              <Input type="password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Nova senha (mín. 6)</Label>
              <Input type="password" value={next} onChange={(e) => setNext(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Confirmar nova senha</Label>
              <Input type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            </div>
            <div className="sm:col-span-2 flex justify-end">
              <Button
                onClick={handleChangePassword}
                disabled={savingPwd || !current || next.length < 6 || next !== confirm}
              >
                {savingPwd ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Salvando…</> : "Alterar senha"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="rounded-2xl border-rose-200 bg-rose-50/40">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-rose-700">
              <ShieldAlert className="h-4 w-4" /> Zona de perigo
            </CardTitle>
            <CardDescription className="text-rose-700/80">
              Ao excluir a conta, todos os projetos que você possui e seus dados relacionados
              (user stories, casos de teste, bugs, auditoria) serão removidos permanentemente.
              Esta ação <b>não pode ser desfeita</b>.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button
              variant="destructive"
              onClick={() => { setConfirmText(""); setConfirmOpen(true); }}
            >
              <Trash2 className="mr-2 h-4 w-4" /> Excluir minha conta
            </Button>
          </CardContent>
        </Card>
      </main>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => { setConfirmOpen(o); if (!o) setConfirmText(""); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza absoluta?</AlertDialogTitle>
            <AlertDialogDescription>
              Digite <b>EXCLUIR</b> abaixo para confirmar a remoção permanente da sua conta e de todos os seus dados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2">
            <Input
              autoFocus
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="Digite EXCLUIR"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteM.isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={confirmText.trim().toUpperCase() !== "EXCLUIR" || deleteM.isPending}
              onClick={(e) => { e.preventDefault(); deleteM.mutate(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteM.isPending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Excluindo…</> : "Excluir permanentemente"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
