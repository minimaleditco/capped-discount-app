/**
 * TEMPORARY diagnostics.
 *
 * The embedded admin app shows a blank frame and we cannot see the browser.
 * This module records what actually reaches the server (path, shop, auth
 * stage, outcome) so the failure can be identified from facts instead of
 * guesses. It stores nothing sensitive: no tokens, no headers, no bodies.
 *
 * Remove once the auth flow is stable.
 */

export const DIAGNOSTICS_BUILD = "diag-1";

export interface DiagnosticEntry {
  at: string;
  path: string;
  method: string;
  shop?: string;
  embedded?: string;
  hasIdToken?: boolean;
  stage:
    | "root"
    | "app:loader"
    | "app:ok"
    | "app:error"
    | "auth:login"
    | "auth:callback"
    | "document";
  status?: number;
  detail?: string;
}

interface DiagnosticsGlobal {
  __pcodDiag?: DiagnosticEntry[];
}

const MAX_ENTRIES = 100;

function store(): DiagnosticEntry[] {
  const g = globalThis as DiagnosticsGlobal;
  if (!g.__pcodDiag) {
    g.__pcodDiag = [];
  }
  return g.__pcodDiag;
}

export function recordDiagnostic(entry: Omit<DiagnosticEntry, "at">): void {
  try {
    const list = store();
    list.push({ at: new Date().toISOString(), ...entry });
    if (list.length > MAX_ENTRIES) {
      list.splice(0, list.length - MAX_ENTRIES);
    }
  } catch {
    // Diagnostics must never break a request.
  }
}

export function readDiagnostics(): DiagnosticEntry[] {
  return [...store()];
}

export function describeRequest(request: Request) {
  const url = new URL(request.url);
  return {
    path: url.pathname,
    method: request.method,
    shop: url.searchParams.get("shop") || undefined,
    embedded: url.searchParams.get("embedded") || undefined,
    hasIdToken: Boolean(url.searchParams.get("id_token")),
  };
}

export function describeError(error: unknown): string {
  if (error instanceof Response) {
    return `Response ${error.status} ${error.statusText || ""}`.trim();
  }
  if (error instanceof Error) {
    return `${error.name}: ${error.message}`;
  }
  return String(error);
}
