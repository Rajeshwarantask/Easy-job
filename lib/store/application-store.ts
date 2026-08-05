/*
  ApplicationStore
  - Pure storage abstraction for parsed applications.
  - Responsibilities:
    * read/write/clear cache from sessionStorage
    * findById, update, toggleStar, updateStatus, getStats
    * subscribe/unsubscribe listeners
    * dispatch APPLICATIONS_UPDATED event when write/clear
  - Must NOT include parsing, Gmail, filtering, sorting, UI, or business rules.
*/

import type { ParsedApplication } from "@/lib/types";

export const APPLICATIONS_UPDATED = "applications-updated" as const;

export interface ApplicationCache {
  version: number;
  parserVersion: string;
  applications: ParsedApplication[];
  lastSync: string | null;
  processed: number;
  syncDurationMs: number;
}

export type ApplicationStoreSnapshot = Readonly<ApplicationCache>;
export type ApplicationStoreListener = (snapshot: ApplicationStoreSnapshot) => void;

const CACHE_KEY = "jobtrail:cache";
const CACHE_VERSION = 1;
const PARSER_VERSION = "1.0.0";

const EMPTY_CACHE: ApplicationCache = {
  version: CACHE_VERSION,
  parserVersion: PARSER_VERSION,
  applications: [],
  lastSync: null,
  processed: 0,
  syncDurationMs: 0,
};

function safeParse(raw: string | null): ApplicationCache | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    // Basic structural validation
    if (
      typeof parsed === "object" &&
      parsed !== null &&
      Array.isArray((parsed as any).applications)
    ) {
      return parsed as ApplicationCache;
    }
    return null;
  } catch {
    return null;
  }
}

const listeners = new Set<ApplicationStoreListener>();

function read(): ApplicationCache {
  if (typeof window === "undefined") return { ...EMPTY_CACHE };
  const raw = sessionStorage.getItem(CACHE_KEY);
  const parsed = safeParse(raw);
  if (!parsed || parsed.version !== CACHE_VERSION) return { ...EMPTY_CACHE };
  // ensure types for missing fields
  return {
    version: parsed.version ?? CACHE_VERSION,
    parserVersion: parsed.parserVersion ?? PARSER_VERSION,
    applications: parsed.applications ?? [],
    lastSync: parsed.lastSync ?? null,
    processed: typeof parsed.processed === "number" ? parsed.processed : (parsed.applications?.length ?? 0),
    syncDurationMs: typeof parsed.syncDurationMs === "number" ? parsed.syncDurationMs : 0,
  };
}

function write(payload: Partial<ApplicationCache>) {
  if (typeof window === "undefined") return;

  const current = read();
  const next: ApplicationCache = {
    version: CACHE_VERSION,
    parserVersion: payload.parserVersion ?? current.parserVersion,
    applications: Array.isArray(payload.applications) ? payload.applications : current.applications,
    lastSync: payload.lastSync ?? current.lastSync,
    processed: typeof payload.processed === "number" ? payload.processed : current.processed,
    syncDurationMs: typeof payload.syncDurationMs === "number" ? payload.syncDurationMs : current.syncDurationMs,
  };

  try {
    sessionStorage.setItem(CACHE_KEY, JSON.stringify(next));
  } catch (e) {
    // swallow storage errors but log for debugging
    // eslint-disable-next-line no-console
    console.error("[ApplicationStore] write failed:", e);
  }

  // notify other windows/components
  try {
    window.dispatchEvent(new Event(APPLICATIONS_UPDATED));
  } catch {}

  notify(next);
}

function clear() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(CACHE_KEY);
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("[ApplicationStore] clear failed:", e);
  }
  try {
    window.dispatchEvent(new Event(APPLICATIONS_UPDATED));
  } catch {}
  notify({ ...EMPTY_CACHE });
}

function findById(id: string): ParsedApplication | null {
  const cache = read();
  const found = cache.applications.find((a) => String(a.id) === String(id));
  return found ?? null;
}

function update(id: string, patch: Partial<ParsedApplication>): ParsedApplication | null {
  const cache = read();
  const apps = cache.applications.map((a) => (String(a.id) === String(id) ? { ...a, ...patch } : a));
  write({ applications: apps, lastSync: cache.lastSync, processed: cache.processed, syncDurationMs: cache.syncDurationMs });
  return apps.find((a) => String(a.id) === String(id)) ?? null;
}

function toggleStar(id: string): ParsedApplication | null {
  const existing = findById(id);
  if (!existing) return null;
  return update(id, { starred: !existing.starred } as Partial<ParsedApplication>);
}

function updateStatus(id: string, status: string): ParsedApplication | null {
  return update(id, { status } as Partial<ParsedApplication>);
}

function getStats() {
  const cache = read();
  const apps = cache.applications;
  const total = apps.length;
  const by_status = {
    applied: apps.filter((a) => a.status === "applied").length,
    assessment: apps.filter((a) => a.status === "assessment").length,
    interview: apps.filter((a) => a.status === "interview").length,
    offer: apps.filter((a) => a.status === "offer").length,
  } as Record<string, number>;
  const average_confidence = total > 0 ? apps.reduce((s, a) => s + (a.parser_confidence ?? 0), 0) / total : 0;
  return { total, by_status, average_confidence };
}

function subscribe(cb: ApplicationStoreListener) {
  listeners.add(cb);
  // call immediately with snapshot
  try {
    cb(read());
  } catch (e) {
    // ignore
  }
  return () => listeners.delete(cb);
}

function notify(snapshot: ApplicationCache) {
  listeners.forEach((l) => {
    try {
      l(Object.freeze({ ...snapshot }));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.error("[ApplicationStore] listener error:", e);
    }
  });
}

// forward window events to listeners so multiple contexts stay in sync
if (typeof window !== "undefined") {
  window.addEventListener(APPLICATIONS_UPDATED, () => {
    notify(read());
  });
}

export const ApplicationStore = Object.freeze({
  read,
  write,
  clear,
  findById,
  update,
  toggleStar,
  updateStatus,
  getStats,
  subscribe,
});

export default ApplicationStore;
