import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { acceptInvitation } from "@/lib/members.functions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast, Toaster } from "sonner";

export const Route = createFileRoute("/invite/$token")({
  head: () => ({ meta: [{ title: "Aceitar convite · QualiDocs" }] }),
  component: InvitePage,
});

function InvitePage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setAuthed(!!data.user));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => setAuthed(!!session?.user));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function accept() {
    setBusy(true);
    setErr(null);
    try {
      const res = await acceptInvitation({ data: { token } });
      toast.success("Convite aceito!");
      navigate({ to: "/projects/$id", params: { id: res.project_id } });
    } catch (e: any) {
      setErr(e?.message ?? "Falha ao aceitar convite.");
    } finally {
      setBusy(false);
    }
  }

  function goSignIn() {
    try {
      sessionStorage.setItem("pending_invite_token", token);
    } catch {}
    navigate({ to: "/auth" });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <Toaster richColors position="top-right" />
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>Convite para colaborar</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            Você recebeu um convite para participar de um projeto no QualiDocs.
          </p>
          {authed === null && <p className="text-sm">Carregando…</p>}
          {authed === false && (
            <>
              <p className="text-sm">Faça login ou crie sua conta para aceitar.</p>
              <Button className="w-full" onClick={goSignIn}>Entrar / Criar conta</Button>
            </>
          )}
          {authed === true && (
            <>
              <Button className="w-full" disabled={busy} onClick={accept}>
                {busy ? "Aceitando…" : "Aceitar convite"}
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link to="/projects">Ir para meus projetos</Link>
              </Button>
            </>
          )}
          {err && <p className="text-sm text-destructive">{err}</p>}
        </CardContent>
      </Card>
    </div>
  );
}
