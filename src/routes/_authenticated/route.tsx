import { createFileRoute, Outlet, redirect, useRouter, Link } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Prefer getSession (reads local storage) to avoid race conditions
    // right after login where getUser() can momentarily return null.
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user) return { user: sessionData.session.user };

    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: () => <Outlet />,
  pendingComponent: AuthPending,
  errorComponent: AuthError,
});

function AuthPending() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/60">
      <Loader2 className="h-6 w-6 animate-spin text-primary" />
    </div>
  );
}

function AuthError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const message = error?.message ?? "";
  const isAuth = /unauthor|auth|jwt|session|token/i.test(message);

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50/60 px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Não foi possível carregar esta página
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {isAuth
            ? "Sua sessão expirou. Faça login novamente para continuar."
            : "Ocorreu uma falha temporária. Tente novamente em alguns instantes."}
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => { router.invalidate(); reset(); }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Tentar novamente
          </button>
          <Link
            to="/auth"
            className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            Ir para login
          </Link>
        </div>
      </div>
    </div>
  );
}
