import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, CheckCircle2, Bug, History, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "QualiDocs — Sistema de gerenciamento de testes" },
      { name: "description", content: "Plataforma completa de QA: plano de teste, user stories, execução, bugs e auditoria — com exportação para Excel." },
      { property: "og:title", content: "QualiDocs — Sistema de gerenciamento de testes" },
      { property: "og:description", content: "Plataforma completa de QA com execução, bugs e auditoria." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Landing,
});

function Landing() {
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/projects", replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  if (checking) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30">
      <div className="mx-auto max-w-5xl px-6 py-16 sm:py-24">
        <div className="text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <FileSpreadsheet className="h-8 w-8" />
          </div>
          <h1 className="text-4xl sm:text-5xl font-bold tracking-tight">QualiDocs</h1>
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground">
            Gerencie planos de teste, user stories, execução, bugs e auditoria em um só lugar. Exporte tudo em uma planilha bonita quando quiser.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Button asChild size="lg"><Link to="/auth">Entrar <ArrowRight className="ml-2 h-4 w-4" /></Link></Button>
          </div>
        </div>

        <div className="mt-16 grid gap-6 sm:grid-cols-3">
          <Feature icon={<CheckCircle2 />} title="Execução de testes" desc="Marque Passou, Falhou ou Bloqueado com um clique. Acompanhe o progresso em tempo real." />
          <Feature icon={<Bug />} title="Módulo de Bugs" desc="Quando um teste falha, registre o defeito com passos e massa de dados pré-preenchidos." />
          <Feature icon={<History />} title="Trilha de auditoria" desc="Cada criação, edição e exclusão é registrada automaticamente — quem, o quê e quando." />
        </div>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <div className="rounded-xl border bg-card p-6 shadow-sm">
      <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">{icon}</div>
      <h3 className="font-semibold">{title}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
    </div>
  );
}
