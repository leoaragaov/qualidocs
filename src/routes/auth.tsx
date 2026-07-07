import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast, Toaster } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileSpreadsheet, Mail, Chrome, KeyRound, Loader2 } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar · QualiDocs" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSending, setForgotSending] = useState(false);
  const [forgotSent, setForgotSent] = useState(false);

  async function sendResetEmail() {
    if (!forgotEmail.trim()) return;
    setForgotSending(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(forgotEmail.trim(), {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) {
        console.error("[QualiDocs] Reset e-mail:", error);
        toast.error(error.message);
        return;
      }
      setForgotSent(true);
      toast.success("E-mail enviado! Verifique sua caixa de entrada.");
    } finally {
      setForgotSending(false);
    }
  }

  useEffect(() => {
    const redirectAfterAuth = () => {
      let dest: { to: string; params?: any } = { to: "/projects" };
      try {
        const t = sessionStorage.getItem("pending_invite_token");
        if (t) {
          sessionStorage.removeItem("pending_invite_token");
          dest = { to: "/invite/$token", params: { token: t } };
        }
      } catch {}
      navigate({ ...dest, replace: true } as any);
    };
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) redirectAfterAuth();
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        if (event === "SIGNED_IN") {
          // fire-and-forget: registra o acesso (IP + geolocalização) no banco
          import("@/lib/access-history.functions")
            .then((m) => m.recordAccess({ data: { event_type: "login" } }))
            .catch((e) => console.warn("[QualiDocs] recordAccess:", e));
        }
        redirectAfterAuth();
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);


  const withLoading = async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  };

  const signIn = () =>
    withLoading(async () => {
      try {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          console.error("[QualiDocs] Falha no login Supabase:", error);
          const msg = (error.message || "").toLowerCase();
          if (msg.includes("invalid login") || msg.includes("invalid credentials") || msg.includes("credentials")) {
            toast.error("Credenciais inválidas", { description: "Verifique seu e-mail e senha e tente novamente." });
          } else if (msg.includes("email not confirmed")) {
            toast.error("E-mail não confirmado", { description: "Confirme seu e-mail antes de entrar." });
          } else if (msg.includes("network") || msg.includes("fetch") || msg.includes("failed to fetch")) {
            toast.error("Falha de conexão com o servidor", { description: "Não conseguimos falar com o backend do QualiDocs. Verifique sua internet e tente novamente." });
          } else {
            toast.error("Não foi possível entrar", { description: error.message });
          }
        }
      } catch (err) {
        console.error("[QualiDocs] Erro inesperado no login:", err);
        toast.error("Erro de conexão", { description: "Não foi possível contatar o servidor. Tente novamente em instantes." });
      }
    });

  const signUp = () =>
    withLoading(async () => {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/projects` },
      });
      if (error) {
        const msg = error.message || "";
        if (/weak|pwned|known to be/i.test(msg)) {
          toast.error("Essa senha é muito comum. Escolha uma senha mais forte (mistura letras, números e símbolos).");
        } else if (/already registered|already exists|user.*exists/i.test(msg)) {
          toast.error("Este e-mail já está cadastrado. Faça login ou recupere sua senha.");
        } else if (/invalid.*email/i.test(msg)) {
          toast.error("E-mail inválido. Verifique e tente novamente.");
        } else {
          toast.error(msg);
        }
      } else {
        toast.success("Conta criada! Verifique seu e-mail se solicitado.");
      }
    });


  const googleIn = () =>
    withLoading(async () => {
      const res = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (res.error) toast.error(res.error.message);
    });

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <Toaster richColors position="top-right" />
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">QualiDocs</h1>
          <p className="text-sm text-muted-foreground">Framework de gerenciamento de testes</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Acesse sua conta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button variant="outline" className="w-full" onClick={googleIn} disabled={loading}>
              <Chrome className="mr-2 h-4 w-4" /> Continuar com Google
            </Button>
            <div className="relative">
              <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">ou</span>
              </div>
            </div>
            <Tabs defaultValue="signin">
              <TabsList className="grid grid-cols-2 w-full">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>
              <TabsContent value="signin" className="space-y-3 pt-3">
                <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label="Senha"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
                <Button className="w-full" onClick={signIn} disabled={loading || !email || !password}>
                  <Mail className="mr-2 h-4 w-4" /> Entrar
                </Button>
                <button
                  type="button"
                  onClick={() => { setForgotSent(false); setForgotEmail(email); setForgotOpen(true); }}
                  className="w-full text-center text-xs text-muted-foreground hover:text-primary hover:underline transition-colors duration-200"
                >
                  Esqueceu a senha?
                </button>
              </TabsContent>
              <TabsContent value="signup" className="space-y-3 pt-3">
                <Field label="E-mail"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label="Senha (mín. 6 caracteres)"><Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
                <Button className="w-full" onClick={signUp} disabled={loading || !email || password.length < 6}>
                  Criar conta
                </Button>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Voltar</Link>
        </p>
      </div>

      <Dialog open={forgotOpen} onOpenChange={(o) => { setForgotOpen(o); if (!o) { setForgotSent(false); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><KeyRound className="h-4 w-4" /> Recuperar senha</DialogTitle>
            <DialogDescription>
              Informe seu e-mail e enviaremos um link para você criar uma nova senha.
            </DialogDescription>
          </DialogHeader>
          {forgotSent ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-4 text-sm text-emerald-800">
              ✅ Link enviado para <b>{forgotEmail}</b>. Verifique também sua pasta de spam.
            </div>
          ) : (
            <div className="space-y-2 py-2">
              <Label className="text-xs text-muted-foreground">E-mail cadastrado</Label>
              <Input
                autoFocus
                type="email"
                value={forgotEmail}
                onChange={(e) => setForgotEmail(e.target.value)}
                placeholder="voce@empresa.com"
                onKeyDown={(e) => { if (e.key === "Enter" && forgotEmail.trim()) sendResetEmail(); }}
              />
            </div>
          )}
          <DialogFooter>
            {forgotSent ? (
              <Button onClick={() => setForgotOpen(false)}>Ok</Button>
            ) : (
              <>
                <Button variant="ghost" onClick={() => setForgotOpen(false)}>Cancelar</Button>
                <Button onClick={sendResetEmail} disabled={forgotSending || !forgotEmail.trim()}>
                  {forgotSending ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Enviando…</> : "Enviar link"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
