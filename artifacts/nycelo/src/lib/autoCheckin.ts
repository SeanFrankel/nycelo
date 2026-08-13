/**
 * Auto check-in preference + status store (module-level, consumed via
 * useSyncExternalStore). The hook in `hooks/useAutoCheckin.ts` drives it;
 * any component can read status or flip the preference.
 */

const PREF_KEY = "nycelo_auto_checkin";
const LOG_KEY = "nycelo_auto_checkin_log";

/** Mirror of the server's per-neighborhood check-in cooldown (30 min). */
export const CHECKIN_COOLDOWN_MS = 30 * 60 * 1000;

export type AutoCheckinStatus =
  | "off" // preference disabled
  | "starting" // enabled, waiting for first fix
  | "active" // watching position
  | "denied" // permission denied/revoked
  | "unavailable" // fix timed out / position unavailable (still retrying)
  | "unsupported"; // no geolocation API

export interface AutoCheckinState {
  enabled: boolean;
  status: AutoCheckinStatus;
  lastHoodName: string | null;
  lastCheckinAt: number | null;
}

function readPref(): boolean {
  try {
    return localStorage.getItem(PREF_KEY) === "1";
  } catch {
    return false;
  }
}

let state: AutoCheckinState = {
  enabled: readPref(),
  status: readPref() ? "starting" : "off",
  lastHoodName: null,
  lastCheckinAt: null,
};

const listeners = new Set<() => void>();

export function subscribeAutoCheckin(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAutoCheckinState(): AutoCheckinState {
  return state;
}

export function patchAutoCheckinState(patch: Partial<AutoCheckinState>): void {
  state = { ...state, ...patch };
  for (const listener of listeners) listener();
}

export function setAutoCheckinEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(PREF_KEY, enabled ? "1" : "0");
  } catch {
    // private mode: preference is session-only
  }
  patchAutoCheckinState({ enabled, status: enabled ? "starting" : "off" });
}

/** Client-side throttle mirroring the server cooldown, persisted across loads. */
function readLog(): Record<string, number> {
  try {
    return JSON.parse(localStorage.getItem(LOG_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function canCheckin(neighborhoodId: number): boolean {
  const at = readLog()[String(neighborhoodId)];
  return !at || Date.now() - at > CHECKIN_COOLDOWN_MS;
}

export function recordCheckinAttempt(neighborhoodId: number): void {
  try {
    const log = readLog();
    const now = Date.now();
    // prune stale entries while we're here
    for (const key of Object.keys(log)) {
      if (now - log[key] > CHECKIN_COOLDOWN_MS) delete log[key];
    }
    log[String(neighborhoodId)] = now;
    localStorage.setItem(LOG_KEY, JSON.stringify(log));
  } catch {
    // storage unavailable — server cooldown still protects us
  }
}
