import { Assignment, CharacterProfile } from "../types";
import { uid } from "./utils";

export function deriveCharactersFromAssignments(assignments: Assignment[]): CharacterProfile[] {
  const byName = new Map<string, { maxSlot: number; count: number }>();

  for (const a of assignments) {
    const name = (a.Character || "").toString().trim();
    if (!name) continue;

    const entry = byName.get(name) ?? { maxSlot: 0, count: 0 };
    entry.count += 1;
    if (typeof a.Slot === "number" && Number.isFinite(a.Slot) && a.Slot > entry.maxSlot) {
      entry.maxSlot = Math.trunc(a.Slot);
    }
    byName.set(name, entry);
  }

  const out: CharacterProfile[] = [];
  for (const [name, v] of byName.entries()) {
    const slotsTotal = Math.max(1, v.maxSlot || v.count || 1);
    out.push({ id: uid("c"), name, slotsTotal });
  }

  out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

export function mergeCharacters(existing: CharacterProfile[], derived: CharacterProfile[]): CharacterProfile[] {
  const byName = new Map<string, CharacterProfile>();

  for (const c of existing) {
    const name = (c.name || "").toString().trim();
    if (!name) continue;
    byName.set(name, { ...c, id: c.id || uid("c"), slotsTotal: clampSlots(c.slotsTotal) });
  }

  for (const d of derived) {
    const name = (d.name || "").toString().trim();
    if (!name) continue;
    const ex = byName.get(name);
    if (!ex) {
      byName.set(name, { ...d, id: d.id || uid("c"), slotsTotal: clampSlots(d.slotsTotal) });
    } else {
      byName.set(name, {
        ...ex,
        slotsTotal: Math.max(clampSlots(ex.slotsTotal), clampSlots(d.slotsTotal)),
      });
    }
  }

  return Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function clampSlots(slotsTotal: number): number {
  const n = Math.trunc(Number(slotsTotal));
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(12, n));
}

export function getCharacterSlotsTotal(characters: CharacterProfile[], characterName: string): number {
  const name = characterName.trim();
  const found = characters.find((c) => c.name === name);
  return found ? clampSlots(found.slotsTotal) : 1;
}

export function usedSlots(assignments: Assignment[], characterName: string): Set<number> {
  const used = new Set<number>();
  for (const a of assignments) {
    if (a.Character !== characterName) continue;
    if (typeof a.Slot === "number" && Number.isFinite(a.Slot)) used.add(Math.trunc(a.Slot));
  }
  return used;
}

export function nextOpenSlot(assignments: Assignment[], characterName: string, slotsTotal: number): number | null {
  const total = clampSlots(slotsTotal);
  const used = usedSlots(assignments, characterName);
  for (let i = 1; i <= total; i++) {
    if (!used.has(i)) return i;
  }
  return null;
}

export function characterHasColonyOnPlanet(assignments: Assignment[], characterName: string, system: string, planet: string): boolean {
  const name = characterName.trim().toLocaleLowerCase();
  const sys = system.trim().toLocaleLowerCase();
  const pl = planet.trim().toLocaleLowerCase();
  if (!name || !sys || !pl) return false;
  return assignments.some(
    (a) =>
      a.Character.trim().toLocaleLowerCase() === name &&
      a.System.trim().toLocaleLowerCase() === sys &&
      a.Planet.trim().toLocaleLowerCase() === pl
  );
}
