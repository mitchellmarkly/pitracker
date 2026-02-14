import React, { useMemo, useState } from "react";
import { Assignment, ScanCell } from "../types";
import { s } from "../lib/utils";

type ResourceSummary = {
  resource: string;
  bestOverall: number | null;
  bestAvailable: number | null;
  activePlanets: number;
  totalPlanets: number;
};

type SystemPick = {
  system: string;
  constellation: string;
  bestOverall: { planet: string; value: number } | null;
  bestAvailable: { planet: string; value: number } | null;
};

type PlanetDetail = {
  planet: string;
  planetType: string;
  resources: { resource: string; value: number; inUse: boolean }[];
};

export default function ExplorerTab(props: {
  regions: string[];
  hmRegion: string;
  setHmRegion: (v: string) => void;
  constellations: string[];
  hmConst: string;
  setHmConst: (v: string) => void;
  scans: ScanCell[];
  assignments: Assignment[];
}) {
  const { regions, hmRegion, setHmRegion, constellations, hmConst, setHmConst, scans, assignments } = props;

  const [query, setQuery] = useState("");
  const [selectedResource, setSelectedResource] = useState<string>("");
  const [selectedSystem, setSelectedSystem] = useState<string>("");

  const regionScans = useMemo(() => {
    return scans.filter((x) => (x.Region || "Unknown") === hmRegion && (!hmConst || x.Constellation === hmConst));
  }, [scans, hmRegion, hmConst]);

  const inUseKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of assignments) {
      set.add(`${a.Region}|${a.Constellation}|${a.System}|${a.Planet}|${a.Resource}`);
    }
    return set;
  }, [assignments]);

  const resourceSummaries = useMemo((): ResourceSummary[] => {
    const byRes = new Map<string, ScanCell[]>();
    for (const sc of regionScans) {
      const r = sc.Resource;
      if (!r) continue;
      const arr = byRes.get(r) ?? [];
      arr.push(sc);
      byRes.set(r, arr);
    }

    const activeCounts = new Map<string, number>();
    const totalCounts = new Map<string, number>();
    for (const a of assignments) {
      if ((a.Region || "Unknown") !== hmRegion) continue;
      if (hmConst && a.Constellation !== hmConst) continue;
      totalCounts.set(a.Resource, (totalCounts.get(a.Resource) ?? 0) + 1);
      if (a.Active) activeCounts.set(a.Resource, (activeCounts.get(a.Resource) ?? 0) + 1);
    }

    const out: ResourceSummary[] = [];
    for (const [resource, list] of byRes.entries()) {
      let bestOverall: number | null = null;
      let bestAvailable: number | null = null;
      for (const sc of list) {
        bestOverall = bestOverall === null ? sc.Value : Math.max(bestOverall, sc.Value);
        const key = `${sc.Region}|${sc.Constellation}|${sc.System}|${sc.Planet}|${sc.Resource}`;
        if (!inUseKeys.has(key)) {
          bestAvailable = bestAvailable === null ? sc.Value : Math.max(bestAvailable, sc.Value);
        }
      }
      out.push({
        resource,
        bestOverall,
        bestAvailable,
        activePlanets: activeCounts.get(resource) ?? 0,
        totalPlanets: totalCounts.get(resource) ?? 0,
      });
    }

    out.sort((a, b) => {
      const av = a.bestAvailable ?? -1;
      const bv = b.bestAvailable ?? -1;
      if (bv !== av) return bv - av;
      const ao = a.bestOverall ?? -1;
      const bo = b.bestOverall ?? -1;
      if (bo !== ao) return bo - ao;
      return a.resource.localeCompare(b.resource);
    });

    return out;
  }, [regionScans, assignments, hmRegion, hmConst, inUseKeys]);

  const filteredSummaries = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return resourceSummaries;
    return resourceSummaries.filter((r) => r.resource.toLowerCase().includes(q));
  }, [resourceSummaries, query]);

  const systemsForResource = useMemo((): SystemPick[] => {
    if (!selectedResource) return [];
    const picks = new Map<string, SystemPick>();
    for (const sc of regionScans) {
      if (sc.Resource !== selectedResource) continue;
      const k = sc.System;
      if (!k) continue;
      const existing = picks.get(k) ?? {
        system: k,
        constellation: sc.Constellation,
        bestOverall: null,
        bestAvailable: null,
      };

      const overall = existing.bestOverall;
      if (!overall || sc.Value > overall.value) {
        existing.bestOverall = { planet: sc.Planet, value: sc.Value };
      }

      const usedKey = `${sc.Region}|${sc.Constellation}|${sc.System}|${sc.Planet}|${sc.Resource}`;
      if (!inUseKeys.has(usedKey)) {
        const avail = existing.bestAvailable;
        if (!avail || sc.Value > avail.value) {
          existing.bestAvailable = { planet: sc.Planet, value: sc.Value };
        }
      }

      picks.set(k, existing);
    }

    const out = Array.from(picks.values());
    out.sort((a, b) => {
      const av = a.bestAvailable?.value ?? -1;
      const bv = b.bestAvailable?.value ?? -1;
      if (bv !== av) return bv - av;
      const ao = a.bestOverall?.value ?? -1;
      const bo = b.bestOverall?.value ?? -1;
      if (bo !== ao) return bo - ao;
      return a.system.localeCompare(b.system);
    });
    return out;
  }, [regionScans, selectedResource, inUseKeys]);

  const systemDetails = useMemo(() => {
    if (!selectedSystem) return { planets: [] as PlanetDetail[], assignmentsByCharacter: [] as { character: string; rows: Assignment[] }[] };

    const planetMap = new Map<string, { planetType: string; res: Map<string, number>; constell: string; region: string }>();
    for (const sc of regionScans) {
      if (sc.System !== selectedSystem) continue;
      const p = sc.Planet;
      if (!p) continue;
      const entry = planetMap.get(p) ?? { planetType: sc.PlanetType, res: new Map(), constell: sc.Constellation, region: sc.Region };
      const existing = entry.res.get(sc.Resource);
      if (existing === undefined || sc.Value > existing) entry.res.set(sc.Resource, sc.Value);
      if (!entry.planetType) entry.planetType = sc.PlanetType;
      planetMap.set(p, entry);
    }

    const planets: PlanetDetail[] = Array.from(planetMap.entries())
      .map(([planet, v]) => {
        const resources = Array.from(v.res.entries())
          .map(([resource, value]) => {
            const usedKey = `${v.region}|${v.constell}|${selectedSystem}|${planet}|${resource}`;
            return { resource, value, inUse: inUseKeys.has(usedKey) };
          })
          .sort((a, b) => b.value - a.value);

        return { planet, planetType: v.planetType || "", resources };
      })
      .sort((a, b) => a.planet.localeCompare(b.planet, undefined, { numeric: true }));

    const sysAssignments = assignments.filter((a) => (a.Region || "Unknown") === hmRegion && a.System === selectedSystem && (!hmConst || a.Constellation === hmConst));
    const byChar = new Map<string, Assignment[]>();
    for (const a of sysAssignments) {
      const arr = byChar.get(a.Character) ?? [];
      arr.push(a);
      byChar.set(a.Character, arr);
    }
    const assignmentsByCharacter = Array.from(byChar.entries())
      .map(([character, rows]) => ({ character, rows: rows.slice().sort((x, y) => (x.Slot ?? 999) - (y.Slot ?? 999)) }))
      .sort((a, b) => a.character.localeCompare(b.character));

    return { planets, assignmentsByCharacter };
  }, [selectedSystem, regionScans, assignments, hmRegion, hmConst, inUseKeys]);

  const selectedResourceName = selectedResource;

  return (
    <div className="grid cols-2">
      <div className="card">
        <div>
          <h2>Resource explorer</h2>
          <p>Pick the best available planet for a resource, then fill the rest of that system.</p>
        </div>

        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Region</label>
            <select value={hmRegion} onChange={(e) => {
              setHmRegion(e.target.value);
              setSelectedResource("");
              setSelectedSystem("");
            }}>
              {regions.length ? regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              )) : (
                <option value="Delve">Delve</option>
              )}
            </select>
          </div>
          <div className="field">
            <label>Constellation</label>
            <select value={hmConst || "__all"} onChange={(e) => {
              const v = e.target.value === "__all" ? "" : e.target.value;
              setHmConst(v);
              setSelectedSystem("");
            }}>
              <option value="__all">All</option>
              {constellations.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Search</label>
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Biomass…" />
          </div>
        </div>

        <div className="tableWrap" style={{ marginTop: 12 }}>
          <table style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Resource</th>
                <th className="right">Best available</th>
                <th className="right">Active</th>
              </tr>
            </thead>
            <tbody>
              {filteredSummaries.map((r) => (
                <tr
                  key={r.resource}
                  style={{ cursor: "pointer" }}
                  onClick={() => {
                    setSelectedResource(r.resource);
                    setSelectedSystem("");
                  }}
                >
                  <td style={{ fontWeight: 700, color: r.resource === selectedResource ? "var(--accent)" : "var(--text)" }}>
                    {r.resource}
                    <span className="sub">best overall: {r.bestOverall === null ? "—" : r.bestOverall.toFixed(2)}</span>
                  </td>
                  <td className="right">
                    <span className={`chip ${r.bestAvailable === null ? "bad" : ""}`}>
                      {r.bestAvailable === null ? "none" : r.bestAvailable.toFixed(2)}
                    </span>
                  </td>
                  <td className="right">
                    <span className="chip good">{r.activePlanets}</span>
                    <span className="sub">total: {r.totalPlanets}</span>
                  </td>
                </tr>
              ))}
              {!filteredSummaries.length && (
                <tr>
                  <td colSpan={3} style={{ padding: 18, textAlign: "center", color: "var(--muted)" }}>
                    No resources match.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {selectedResourceName && (
          <div style={{ marginTop: 12 }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div>
                <div style={{ fontWeight: 800 }}>{selectedResourceName}</div>
                <div style={{ color: "var(--muted)", fontSize: 12 }}>Pick a system, then review all other planets/resources in it.</div>
              </div>
              <button className="button ghost" onClick={() => { setSelectedResource(""); setSelectedSystem(""); }}>
                Clear
              </button>
            </div>

            <div className="tableWrap" style={{ marginTop: 10 }}>
              <table style={{ minWidth: 0 }}>
                <thead>
                  <tr>
                    <th>System</th>
                    <th className="right">Best available</th>
                    <th className="right">Best overall</th>
                  </tr>
                </thead>
                <tbody>
                  {systemsForResource.map((sys) => (
                    <tr
                      key={sys.system}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedSystem(sys.system)}
                    >
                      <td style={{ fontWeight: 700, color: sys.system === selectedSystem ? "var(--accent)" : "var(--text)" }}>
                        {sys.system}
                        <span className="sub">{sys.constellation || ""}</span>
                      </td>
                      <td className="right">
                        {sys.bestAvailable ? (
                          <span className="chip good">{sys.bestAvailable.value.toFixed(2)} <span style={{ opacity: 0.8 }}>({sys.bestAvailable.planet})</span></span>
                        ) : (
                          <span className="chip bad">none</span>
                        )}
                      </td>
                      <td className="right">
                        {sys.bestOverall ? (
                          <span className="chip">{sys.bestOverall.value.toFixed(2)} <span style={{ opacity: 0.8 }}>({sys.bestOverall.planet})</span></span>
                        ) : (
                          <span className="chip">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                  {!systemsForResource.length && (
                    <tr>
                      <td colSpan={3} style={{ padding: 14, textAlign: "center", color: "var(--muted)" }}>
                        No scan data for this resource in the current filter.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      <div className="card">
        <div>
          <h2>System view</h2>
          <p>{selectedSystem ? `All planets/resources in ${selectedSystem}.` : "Select a system from the resource explorer."}</p>
        </div>

        {selectedSystem && (
          <>
            <div style={{ marginTop: 10 }}>
              {systemDetails.assignmentsByCharacter.length ? (
                <div className="row" style={{ gap: 8, marginBottom: 10 }}>
                  {systemDetails.assignmentsByCharacter.map((g) => (
                    <span key={g.character} className="chip good">
                      {g.character}: {g.rows.filter((x) => x.Active).length}/{g.rows.length}
                    </span>
                  ))}
                </div>
              ) : (
                <div style={{ color: "var(--muted)", fontSize: 12, marginTop: 8 }}>
                  No assignments in this system yet.
                </div>
              )}

              <div className="tableWrap" style={{ marginTop: 10 }}>
                <table>
                  <thead>
                    <tr>
                      <th>Planet</th>
                      <th>Type</th>
                      <th>Top resources</th>
                    </tr>
                  </thead>
                  <tbody>
                    {systemDetails.planets.map((p) => (
                      <tr key={p.planet}>
                        <td style={{ fontWeight: 700 }}>{p.planet}</td>
                        <td>{p.planetType || "—"}</td>
                        <td>
                          <div className="row" style={{ gap: 6 }}>
                            {p.resources.slice(0, 8).map((r) => (
                              <span
                                key={r.resource}
                                className={`chip ${r.inUse ? "good" : ""}`}
                                style={{
                                  borderColor:
                                    r.resource === selectedResourceName ? "rgba(96,165,250,.55)" : undefined,
                                }}
                              >
                                {r.resource} {r.value.toFixed(2)}
                              </span>
                            ))}
                          </div>
                          {p.resources.length > 8 && (
                            <div style={{ marginTop: 6, color: "var(--muted)", fontSize: 12 }}>
                              +{p.resources.length - 8} more
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                    {!systemDetails.planets.length && (
                      <tr>
                        <td colSpan={3} style={{ padding: 16, textAlign: "center", color: "var(--muted)" }}>
                          No scan data for this system in the current filter.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {!selectedSystem && (
          <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13 }}>
            Start by selecting a resource (e.g. Biomass), then choose a system with a strong available planet.
          </div>
        )}
      </div>
    </div>
  );
}
