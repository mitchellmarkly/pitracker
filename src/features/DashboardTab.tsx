import React, { useMemo } from "react";
import { Assignment, YieldLog } from "../types";

type Row = {
  resource: string;
  active: number;
  total: number;
  systems: number;
  latestYield?: { date: string; amount: number };
};

export default function DashboardTab(props: {
  regions: string[];
  hmRegion: string;
  setHmRegion: (v: string) => void;
  assignments: Assignment[];
  yields: YieldLog[];
}) {
  const { regions, hmRegion, setHmRegion, assignments, yields } = props;

  const latestYieldByProduct = useMemo(() => {
    const m = new Map<string, { date: string; amount: number }>();
    for (const y of yields) {
      if (!y.Product) continue;
      const ex = m.get(y.Product);
      if (!ex || y.Date > ex.date) {
        m.set(y.Product, { date: y.Date, amount: y.Amount });
      }
    }
    return m;
  }, [yields]);

  const rows = useMemo(() => {
    const byRes = new Map<string, { active: number; total: number; systems: Set<string> }>();
    for (const a of assignments) {
      if ((a.Region || "Unknown") !== hmRegion) continue;
      const key = a.Resource;
      if (!key) continue;
      const entry = byRes.get(key) ?? { active: 0, total: 0, systems: new Set<string>() };
      entry.total += 1;
      if (a.Active) entry.active += 1;
      entry.systems.add(a.System);
      byRes.set(key, entry);
    }

    const out: Row[] = [];
    for (const [resource, v] of byRes.entries()) {
      out.push({
        resource,
        active: v.active,
        total: v.total,
        systems: v.systems.size,
        latestYield: latestYieldByProduct.get(resource),
      });
    }

    out.sort((a, b) => {
      if (b.active !== a.active) return b.active - a.active;
      if (b.total !== a.total) return b.total - a.total;
      return a.resource.localeCompare(b.resource);
    });

    return out;
  }, [assignments, hmRegion, latestYieldByProduct]);

  const totals = useMemo(() => {
    const active = assignments.filter((a) => (a.Region || "Unknown") === hmRegion && a.Active).length;
    const total = assignments.filter((a) => (a.Region || "Unknown") === hmRegion).length;
    const uniqueSystems = new Set(assignments.filter((a) => (a.Region || "Unknown") === hmRegion).map((a) => a.System)).size;
    return { active, total, uniqueSystems };
  }, [assignments, hmRegion]);

  const maxActive = useMemo(() => Math.max(1, ...rows.map((r) => r.active)), [rows]);

  return (
    <div className="grid cols-2">
      <div className="card">
        <div>
          <h2>Dashboard</h2>
          <p>How your planets are allocated by resource (and latest pasted yields when available).</p>
        </div>

        <div className="grid cols-3" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Region</label>
            <select value={hmRegion} onChange={(e) => setHmRegion(e.target.value)}>
              {regions.length ? regions.map((r) => (
                <option key={r} value={r}>{r}</option>
              )) : (
                <option value="Delve">Delve</option>
              )}
            </select>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Active planets</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{totals.active}</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>of {totals.total} assigned</div>
          </div>
          <div className="card" style={{ padding: 12 }}>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>Systems in use</div>
            <div style={{ fontSize: 20, fontWeight: 900 }}>{totals.uniqueSystems}</div>
            <div style={{ color: "var(--muted)", fontSize: 12 }}>in {hmRegion}</div>
          </div>
        </div>

        <div className="tableWrap" style={{ marginTop: 12 }}>
          <table style={{ minWidth: 0 }}>
            <thead>
              <tr>
                <th>Resource</th>
                <th style={{ width: 220 }}>Allocation</th>
                <th className="right">Active</th>
                <th className="right">Systems</th>
                <th className="right">Latest yield</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const pct = Math.min(1, r.active / maxActive);
                return (
                  <tr key={r.resource}>
                    <td style={{ fontWeight: 800 }}>{r.resource}</td>
                    <td>
                      <div className="bar">
                        <span style={{ width: `${Math.round(pct * 100)}%` }} />
                      </div>
                      <span className="sub">{r.total} assigned</span>
                    </td>
                    <td className="right">
                      <span className="chip good">{r.active}</span>
                    </td>
                    <td className="right">
                      <span className="chip">{r.systems}</span>
                    </td>
                    <td className="right">
                      {r.latestYield ? (
                        <span className="chip">
                          {r.latestYield.amount.toLocaleString()} <span style={{ opacity: 0.75 }}>({r.latestYield.date})</span>
                        </span>
                      ) : (
                        <span className="chip" style={{ opacity: 0.7 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {!rows.length && (
                <tr>
                  <td colSpan={5} style={{ padding: 18, textAlign: "center", color: "var(--muted)" }}>
                    No assignments in this region yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div>
          <h2>Notes</h2>
          <p>Use the Resource explorer to pick a high-yield system for a needed resource, then fill the rest of the system.</p>
        </div>

        <div style={{ marginTop: 12, color: "var(--muted)", fontSize: 13, lineHeight: 1.45 }}>
          <div style={{ marginBottom: 10 }}>
            This dashboard counts planets based on your Assignments. If you want “planned” vs “running”, toggle Active.
          </div>
          <div>
            Latest yield values appear once you paste totals in Yield Tracker. Later we can compute averages and efficiency.
          </div>
        </div>
      </div>
    </div>
  );
}
