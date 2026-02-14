import React from "react";
import { ScanCell } from "../types";
import { heatColor } from "../lib/utils";

export default function HeatmapTab(props: {
  regions: string[];
  hmRegion: string;
  setHmRegion: (v: string) => void;
  constellations: string[];
  hmConst: string;
  setHmConst: (v: string) => void;
  resources: string[];
  hmResource: string;
  setHmResource: (v: string) => void;
  scanMinMax: { min: number; max: number; count: number };
  heatRows: { System: string; planets: ScanCell[] }[];
  inUseKeys: Set<string>;
  onExportRegion: () => void;
  exportDisabled: boolean;
}) {
  const {
    regions,
    hmRegion,
    setHmRegion,
    constellations,
    hmConst,
    setHmConst,
    resources,
    hmResource,
    setHmResource,
    scanMinMax,
    heatRows,
    inUseKeys,
    onExportRegion,
    exportDisabled,
  } = props;

  return (
    <div className="card">
      <div className="row" style={{ justifyContent: "space-between" }}>
        <div>
          <h2>Heatmap</h2>
          <p>Filter your scanned planets (imported via JSON).</p>
        </div>
        <button className="button" onClick={onExportRegion} disabled={exportDisabled}>
          Export {hmRegion || "Region"} Heatmap
        </button>
      </div>

      <div className="grid cols-3" style={{ marginTop: 12 }}>
        <div className="field">
          <label>Region</label>
          <select value={hmRegion} onChange={(e) => setHmRegion(e.target.value)}>
            {regions.length ? (
              regions.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))
            ) : (
              <option value="Delve">Delve</option>
            )}
          </select>
        </div>

        <div className="field">
          <label>Constellation</label>
          <select value={hmConst || "__all"} onChange={(e) => setHmConst(e.target.value === "__all" ? "" : e.target.value)}>
            <option value="__all">All</option>
            {constellations.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Resource</label>
          <select value={hmResource || "__all"} onChange={(e) => setHmResource(e.target.value === "__all" ? "" : e.target.value)}>
            <option value="__all">All</option>
            {resources.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="row" style={{ marginTop: 12, justifyContent: "space-between" }}>
        <div className="row">
          <span className="badge">{scanMinMax.count} cells</span>
          <span className="badge">min {scanMinMax.min.toFixed(2)}</span>
          <span className="badge">max {scanMinMax.max.toFixed(2)}</span>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <div className="heatbar" />
          <span style={{ color: "var(--muted)", fontSize: 12 }}>low → high</span>
        </div>
      </div>

      <div className="tableWrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>Planet</th>
              <th>Type</th>
              <th className="right">Score</th>
              <th className="right">In use?</th>
            </tr>
          </thead>
          <tbody>
            {heatRows.map((sys) => (
              <React.Fragment key={sys.System}>
                {sys.planets.map((p, idx) => {
                  const key = `${p.Region}|${p.Constellation}|${p.System}|${p.Planet}|${p.Resource}`;
                  const used = inUseKeys.has(key);
                  return (
                    <tr key={key} style={{ background: heatColor(p.Value, scanMinMax.min, scanMinMax.max) }}>
                      <td style={{ fontWeight: 600 }}>{idx === 0 ? sys.System : ""}</td>
                      <td>{p.Planet}</td>
                      <td>{p.PlanetType || "—"}</td>
                      <td className="right">{p.Value.toFixed(2)}</td>
                      <td className="right">
                        <span className={`chip ${used ? "good" : ""}`}>{used ? "Yes" : "No"}</span>
                      </td>
                    </tr>
                  );
                })}
              </React.Fragment>
            ))}
            {!heatRows.length && (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                  No scan data for this filter. Import a heatmap JSON (e.g. public/heatmap-delve.json).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
