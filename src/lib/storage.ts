import { AppState, Assignment, CharacterProfile, ScanCell, YieldLog } from "../types";
import { n, s, uid } from "./utils";
import { clampSlots, deriveCharactersFromAssignments, mergeCharacters } from "./characters";

export const LS_KEY = "pi_tracker_state_v1";
const API_BASE = (import.meta.env.VITE_API_BASE ?? "/api").toString().trim();
const API_TOKEN = (import.meta.env.VITE_API_TOKEN ?? "").toString().trim();

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  if (API_TOKEN) headers["X-Api-Token"] = API_TOKEN;
  return headers;
}

export function defaultState(): AppState {
  return { version: 1, characters: [], assignments: [], scans: [], yields: [] };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return defaultState();
    return normalizeLoadedState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

export async function hydrateState(): Promise<AppState> {
  if (!API_BASE) return loadState();
  try {
    const res = await fetch(`${API_BASE}/state`, { method: "GET", headers: apiHeaders() });
    if (!res.ok) throw new Error(`state fetch failed: ${res.status}`);
    const json = await res.json();
    const next = normalizeLoadedState(json);
    localStorage.setItem(LS_KEY, JSON.stringify(next));
    return next;
  } catch {
    return loadState();
  }
}

export function saveState(state: AppState) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }

  if (!API_BASE) return;
  void fetch(`${API_BASE}/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...apiHeaders() },
    body: JSON.stringify(state),
  }).catch(() => {
    // ignore API persistence failures in UI flow
  });
}

export function wipeState(): AppState {
  try {
    localStorage.removeItem(LS_KEY);
  } catch {
    // ignore
  }

  if (API_BASE) {
    void fetch(`${API_BASE}/state`, { method: "DELETE", headers: apiHeaders() }).catch(() => {
      // ignore
    });
  }

  return defaultState();
}

export function importStateFromJson(raw: any): AppState {
  try {
    return normalizeLoadedState(raw);
  } catch {
    return defaultState();
  }
}

function normalizeLoadedState(raw: any): AppState {
  const base = defaultState();
  if (!raw || typeof raw !== "object") return base;

  const charactersRaw = Array.isArray(raw.characters) ? raw.characters : [];

  const assignments = Array.isArray(raw.assignments) ? raw.assignments : [];
  const scans = Array.isArray(raw.scans) ? raw.scans : [];
  const yields = Array.isArray(raw.yields) ? raw.yields : [];

  const normCharacters: CharacterProfile[] = charactersRaw
    .map((c: any) => {
      const name = s(c.name || c.Name);
      if (!name) return null;
      const slotsTotal = clampSlots(n(c.slotsTotal ?? c.SlotsTotal ?? c.slots ?? c.Slots) ?? 1);
      return { id: s(c.id) || uid("c"), name, slotsTotal } as CharacterProfile;
    })
    .filter(Boolean) as CharacterProfile[];

  const normAssignments: Assignment[] = assignments
    .map((a: any) => {
      const Character = s(a.Character);
      const System = s(a.System);
      const Planet = s(a.Planet);
      const Resource = s(a.Resource);
      if (!Character || !System || !Planet || !Resource) return null;

      const Slot = n(a.Slot);
      return {
        id: s(a.id) || uid("a"),
        Character,
        Slot: Slot === null ? null : Math.trunc(Slot),
        Region: s(a.Region),
        Constellation: s(a.Constellation),
        System,
        Planet,
        PlanetType: s(a.PlanetType),
        Resource,
        Active: Boolean(a.Active ?? true),
        Notes: s(a.Notes),
      } as Assignment;
    })
    .filter(Boolean) as Assignment[];

  const normScans: ScanCell[] = scans
    .map((x: any) => {
      const Region = s(x.Region);
      const System = s(x.System);
      const Planet = s(x.Planet);
      const Resource = s(x.Resource);
      const Value = n(x.Value);
      if (!Region || !System || !Planet || !Resource || Value === null) return null;

      return {
        id: s(x.id) || uid("s"),
        Region,
        Constellation: s(x.Constellation),
        System,
        Planet,
        PlanetType: s(x.PlanetType),
        Resource,
        Value,
      } as ScanCell;
    })
    .filter(Boolean) as ScanCell[];

  const normYields: YieldLog[] = yields
    .map((y: any) => {
      const Date = s(y.Date);
      const Product = s(y.Product);
      const Amount = n(y.Amount);
      if (!Date || !Product || Amount === null) return null;

      return {
        id: s(y.id) || uid("y"),
        Date,
        Product,
        Amount,
        Notes: s(y.Notes),
      } as YieldLog;
    })
    .filter(Boolean) as YieldLog[];

  const derived = deriveCharactersFromAssignments(normAssignments);
  const characters = mergeCharacters(normCharacters, derived);

  return { version: 1, characters, assignments: normAssignments, scans: normScans, yields: normYields };
}
