import * as XLSX from "xlsx";
import { AppState, Assignment } from "../types";
import { deriveCharactersFromAssignments } from "./characters";
import { n, s, uid } from "./utils";

function sheetToRows(wb: XLSX.WorkBook, name: string) {
  const ws = wb.Sheets[name];
  if (!ws) return null;
  return XLSX.utils.sheet_to_json(ws, { defval: "" }) as any[];
}

function parseAssignments(rows: any[]): Assignment[] {
  const out: Assignment[] = [];
  for (const r of rows) {
    const Character = s(r["Character"]);
    const System = s(r["System"]);
    const Planet = s(r["Planet"]);
    const Resource = s(r["Resource"]);
    if (!Character || !System || !Planet || !Resource) continue;

    const Slot = n(r["Slot"]);
    const ActiveRaw = s(r["Active"]).toLowerCase();
    const Active = ActiveRaw ? ["yes", "y", "true", "1"].includes(ActiveRaw) : true;

    out.push({
      id: uid("a"),
      Character,
      Slot: Slot === null ? null : Math.trunc(Slot),
      Region: s(r["Region"]),
      Constellation: s(r["Constellation"]),
      System,
      Planet,
      PlanetType: s(r["Planet Type"]),
      Resource,
      Active,
      Notes: s(r["Notes"]),
    });
  }
  return out;
}

export async function importAssignmentsXlsx(file: File): Promise<Pick<AppState, "assignments" | "characters">> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const rows = sheetToRows(wb, "Assignments") ?? sheetToRows(wb, "Used") ?? [];
  const assignments = parseAssignments(rows);

  const characters = deriveCharactersFromAssignments(assignments);

  return { assignments, characters };
}
