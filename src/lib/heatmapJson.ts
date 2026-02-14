import { HeatmapJsonV1, ScanCell } from "../types";
import { downloadJson, n, s, todayISO, uid } from "./utils";

export async function importHeatmapJson(file: File): Promise<{ region: string; scans: ScanCell[] }> {
  const text = await file.text();
  const obj = JSON.parse(text) as HeatmapJsonV1 | any;

  const rawScans: any[] = Array.isArray(obj) ? obj : Array.isArray(obj?.scans) ? obj.scans : [];
  if (!rawScans.length) throw new Error("No scans found in JSON.");

  const regionFromFile = s(obj?.region || obj?.Region || rawScans?.[0]?.Region || "Unknown");

  const scans: ScanCell[] = rawScans
    .map((r) => {
      const Region = s(r.Region || regionFromFile);
      const Constellation = s(r.Constellation);
      const System = s(r.System);
      const Planet = s(r.Planet);
      const PlanetType = s(r.PlanetType);
      const Resource = s(r.Resource);
      const Value = n(r.Value);
      if (!Region || !System || !Planet || !Resource || Value === null) return null;
      return { id: uid("s"), Region, Constellation, System, Planet, PlanetType, Resource, Value } as ScanCell;
    })
    .filter(Boolean) as ScanCell[];

  if (!scans.length) throw new Error("JSON was read, but no valid scan rows were found.");
  return { region: regionFromFile, scans };
}

export function exportHeatmapJson(region: string, scans: ScanCell[]) {
  const regionScans = scans.filter((x) => (x.Region || "Unknown") === region);
  const resources = Array.from(new Set(regionScans.map((x) => x.Resource))).sort();

  const payload = {
    schemaVersion: 1,
    kind: "pi-heatmap",
    region,
    generatedAt: new Date().toISOString(),
    resources,
    scans: regionScans.map((x) => ({
      Region: x.Region,
      Constellation: x.Constellation,
      System: x.System,
      Planet: x.Planet,
      PlanetType: x.PlanetType,
      Resource: x.Resource,
      Value: x.Value,
    })),
  };

  downloadJson(`heatmap-${region.toLowerCase()}_${todayISO()}.json`, payload);
}
