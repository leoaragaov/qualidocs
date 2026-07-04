import { useRef, useState } from "react";
import { toast } from "sonner";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download, Upload, ShieldCheck } from "lucide-react";
import {
  downloadBackup,
  readImportedBackup,
  saveLocalSnapshot,
  type ProjectSnapshot,
} from "@/lib/backup";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  projectName?: string;
  snapshot: ProjectSnapshot | null;
  onRestored?: (data: ProjectSnapshot) => void;
}

export function BackupDialog({ open, onOpenChange, projectId, projectName, snapshot, onRestored }: Props) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [importing, setImporting] = useState(false);

  const handleExport = () => {
    if (!snapshot) {
      toast.error("Nada para exportar ainda (Nothing to export yet)");
      return;
    }
    try {
      downloadBackup(projectId, snapshot, projectName);
      toast.success("Backup exportado (Backup exported)");
    } catch (e: any) {
      toast.error(e?.message || "Falha ao exportar (Export failed)");
    }
  };

  const handleImportClick = () => fileRef.current?.click();

  const handleFile = async (file: File | null) => {
    if (!file) return;
    setImporting(true);
    try {
      const parsed = await readImportedBackup(file);
      saveLocalSnapshot(projectId, parsed.data);
      onRestored?.(parsed.data);
      toast.success("Backup importado e salvo localmente (Backup imported & saved locally)");
      onOpenChange(false);
    } catch (e: any) {
      toast.error(e?.message || "Arquivo inválido (Invalid file)");
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            Backup e Recuperação (Backup & Recovery)
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 text-sm text-muted-foreground">
          <p>
            Uma cópia local do projeto é salva automaticamente no navegador a cada alteração.
            Use as opções abaixo para exportar essa cópia em <code>.json</code> ou restaurar de um
            arquivo anterior.
          </p>
          <p className="italic text-xs">
            A local copy of the project is auto-saved in your browser on every change. Use the
            options below to export it as <code>.json</code> or restore from a previous file.
          </p>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          <Button variant="outline" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" /> Exportar Backup (Export)
          </Button>
          <Button onClick={handleImportClick} disabled={importing}>
            <Upload className="mr-2 h-4 w-4" /> {importing ? "Importando…" : "Importar Backup (Import)"}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Fechar (Close)</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
