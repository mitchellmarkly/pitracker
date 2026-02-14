import * as XLSX from "xlsx";
import { AppState, Assignment } from "../types";
import { deriveCharactersFromAssignments } from "./characters";
import { n, s, uid } from "./utils";

const MAX_XLSX_BYTES = 2 * 1024 * 1024; // 2 MiB
const MAX_ASSIGNMENT_ROWS = 10_000;

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
  if (file.size > MAX_XLSX_BYTES) {
    throw new Error(`XLSX is too large (${Math.round(file.size / 1024)} KB). Limit is ${Math.round(MAX_XLSX_BYTES / 1024)} KB.`);
  }

  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });

  const rows = sheetToRows(wb, "Assignments") ?? sheetToRows(wb, "Used") ?? [];
  if (rows.length > MAX_ASSIGNMENT_ROWS) {
    throw new Error(`Too many assignment rows (${rows.length}). Limit is ${MAX_ASSIGNMENT_ROWS}.`);
  }

  const assignments = parseAssignments(rows);

  const characters = deriveCharactersFromAssignments(assignments);

  return { assignments, characters };
}
