import { Component, type ErrorInfo, type ReactNode } from "react";
import { downloadEmergencyBackup } from "@/lib/backup";
import { reportLovableError } from "@/lib/lovable-error-reporting";

interface State {
  error: Error | null;
}

export class GlobalErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    try {
      reportLovableError(error, { boundary: "global_error_boundary", componentStack: info.componentStack });
    } catch {
      // ignore reporting failure
    }
    // eslint-disable-next-line no-console
    console.error("[GlobalErrorBoundary]", error, info);
  }

  private handleReload = () => {
    if (typeof window !== "undefined") window.location.reload();
  };

  private handleDownload = () => {
    const ok = downloadEmergencyBackup();
    if (!ok && typeof window !== "undefined") {
      window.alert(
        "Nenhum backup local encontrado (No local backup found).",
      );
    }
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50/60 px-4">
        <div className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm">
          <h1 className="text-xl font-semibold tracking-tight text-foreground">
            Algo deu errado (Something went wrong)
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            A aplicação encontrou uma falha inesperada. Seus dados vigentes ficaram salvos
            localmente — você pode recarregar a página ou baixar um backup de emergência.
            <br />
            <span className="italic">
              The app hit an unexpected error. Your latest data is stored locally — you can reload
              the page or download an emergency backup.
            </span>
          </p>
          {this.state.error?.message && (
            <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-slate-50 p-3 text-left text-xs text-rose-700 whitespace-pre-wrap">
              {this.state.error.message}
            </pre>
          )}
          <div className="mt-5 flex flex-wrap justify-center gap-2">
            <button
              onClick={this.handleReload}
              className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              Recarregar página (Reload page)
            </button>
            <button
              onClick={this.handleDownload}
              className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              Baixar backup de emergência (Download emergency backup)
            </button>
          </div>
        </div>
      </div>
    );
  }
}
