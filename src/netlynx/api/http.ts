// Shared fetch helper: per-URL caching (10 min), timeouts, and typed errors.
// Every source client goes through this so one slow or failing API can't stall the others.

export type ApiErrorKind = 'timeout' | 'network' | 'http' | 'not_found' | 'not_configured' | 'bad_data';

export class ApiError extends Error {
  kind: ApiErrorKind;
  status?: number;
  constructor(kind: ApiErrorKind, status?: number) {
    super(kind);
    this.kind = kind;
    this.status = status;
  }
}

const TTL = 10 * 60_000;
const cache = new Map<string, { at: number; value: Promise<unknown> }>();

type Opts = {
  timeoutMs?: number;
  init?: RequestInit;
  /** Defaults to the URL; set it when the request body (not the URL) varies. */
  key?: string;
  /** Map specific HTTP statuses to error kinds (e.g. 404 → not_found). */
  statusKinds?: Record<number, ApiErrorKind>;
};

async function run<T>(url: string, o: Opts): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), o.timeoutMs ?? 12000);
  let res: Response;
  try {
    res = await fetch(url, { ...o.init, signal: ctrl.signal });
  } catch {
    throw new ApiError(ctrl.signal.aborted ? 'timeout' : 'network');
  } finally {
    clearTimeout(timer);
  }
  if (!res.ok) {
    let kind = o.statusKinds?.[res.status] ?? 'http';
    // Our own /api functions answer 503 {error:"not_configured"} when a secret is missing.
    if (res.status === 503) {
      const body = await res.json().catch(() => null);
      if (body?.error === 'not_configured' || body?.error === 'bad_credentials') kind = 'not_configured';
    }
    throw new ApiError(kind, res.status);
  }
  try {
    return (await res.json()) as T;
  } catch {
    throw new ApiError('bad_data');
  }
}

/** Cached JSON GET/POST. Failed requests are evicted so a retry really retries. */
export function getJSON<T>(url: string, o: Opts = {}): Promise<T> {
  const key = o.key ?? url;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as Promise<T>;
  const value = run<T>(url, o);
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

/** Cache an arbitrary async computation under a key (for multi-request sources). */
export function cached<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit.value as Promise<T>;
  const value = fn();
  cache.set(key, { at: Date.now(), value });
  value.catch(() => cache.delete(key));
  return value;
}

export const r4 = (n: number) => n.toFixed(4);
