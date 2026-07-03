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
import { FileSpreadsheet, Mail, Chrome } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({ meta: [{ title: "Entrar · Citse QA" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

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
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) redirectAfterAuth();
    });
    return () => sub.subscription.unsubscribe();
  }, [navigate]);


  const withLoading = async (fn: () => Promise<void>) => {
    setLoading(true);
    try { await fn(); } finally { setLoading(false); }
  };

  const signIn = () =>
    withLoading(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) toast.error(error.message);
    });

  const signUp = () =>
    withLoading(async () => {
      const { error } = await supabase.auth.signUp({
        email, password,
        options: { emailRedirectTo: `${window.location.origin}/projects` },
      });
      if (error) toast.error(error.message);
      else toast.success("Conta criada! Verifique seu e-mail se solicitado.");
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
          <h1 className="text-2xl font-semibold tracking-tight">Citse QA</h1>
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
