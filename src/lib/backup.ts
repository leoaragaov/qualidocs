// Client-side backup, sanitization and local persistence utilities.
// Used by the Backup & Recovery dialog and the global error boundary.

const BACKUP_KEY_PREFIX = "qualidocs:backup:";
const EMERGENCY_KEY = "qualidocs:backup:__last__";

export type ProjectSnapshot = Record<string, unknown> & { project?: { id?: string; projeto?: string } };

/** Very light XSS-oriented sanitizer for user-typed strings.
 *  Strips <script> blocks, on* event handlers and javascript: URLs.
 *  Preserves normal Unicode/Portuguese characters. */
export function sanitizeText(input: unknown): string {
  if (input == null) return "";
  const s = String(input);
  return s
    .replace(/<\s*script[\s\S]*?<\s*\/\s*script\s*>/gi, "")
    .replace(/<\s*\/?\s*script\b[^>]*>/gi, "")
    .replace(/\son[a-z]+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript\s*:/gi, "");
}

/** Deep-sanitize every string field inside a plain object/array. */
export function sanitizeDeep<T>(value: T): T {
  if (value == null) return value;
  if (typeof value === "string") return sanitizeText(value) as unknown as T;
  if (Array.isArray(value)) return value.map((v) => sanitizeDeep(v)) as unknown as T;
  if (typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = sanitizeDeep(v);
    }
    return out as unknown as T;
  }
  return value;
}

/** Detect plaintext credentials being typed in a free-text field. */
export function looksLikePlainCredential(text: string): boolean {
  if (!text) return false;
  return /\b(senha|password|pwd|passwd|pass)\s*[:=]\s*\S+/i.test(text);
}

/** Persist a snapshot to localStorage (auto-save). Safe no-op on SSR / quota errors. */
export function saveLocalSnapshot(projectId: string, snapshot: ProjectSnapshot): void {
  if (typeof window === "undefined") return;
  try {
    const payload = JSON.stringify({
      version: 1,
      projectId,
      savedAt: new Date().toISOString(),
      data: snapshot,
    });
    window.localStorage.setItem(BACKUP_KEY_PREFIX + projectId, payload);
    window.localStorage.setItem(EMERGENCY_KEY, payload);
  } catch {
    // storage full or unavailable — ignore
  }
}

export function readLocalSnapshot(projectId: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(BACKUP_KEY_PREFIX + projectId);
  } catch {
    return null;
  }
}

export function readEmergencySnapshot(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(EMERGENCY_KEY);
  } catch {
    return null;
  }
}

export function downloadBackup(projectId: string, snapshot: ProjectSnapshot, filenameHint?: string): void {
  const payload = {
    version: 1,
    projectId,
    savedAt: new Date().toISOString(),
    data: snapshot,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  const safeName = (filenameHint || projectId).replace(/[^\w\-]+/g, "_").slice(0, 60);
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  a.download = `qualidocs-backup-${safeName}-${ts}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function downloadEmergencyBackup(): boolean {
  const raw = readEmergencySnapshot();
  if (!raw) return false;
  const blob = new Blob([raw], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `qualidocs-emergency-${new Date().toISOString().replace(/[:.]/g, "-")}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return true;
}

export async function readImportedBackup(file: File): Promise<{ projectId?: string; data: ProjectSnapshot }> {
  const text = await file.text();
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || !("data" in parsed)) {
    throw new Error("Arquivo de backup inválido (Invalid backup file)");
  }
  return { projectId: parsed.projectId, data: parsed.data as ProjectSnapshot };
}
