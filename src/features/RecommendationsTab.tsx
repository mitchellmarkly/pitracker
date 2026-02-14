import React from "react";
import { ScanCell } from "../types";

export default function RecommendationsTab(props: {
  recommendations: Array<ScanCell & { inUse: boolean }>;
}) {
  const { recommendations } = props;

  return (
    <div className="card">
      <h2>Recommendations</h2>
      <p>Top scanned planets (current heatmap filter). Helps avoid doubling up.</p>

      <div className="tableWrap" style={{ marginTop: 12 }}>
        <table>
          <thead>
            <tr>
              <th>System</th>
              <th>Planet</th>
              <th>Type</th>
              <th className="right">Score</th>
              <th className="right">Status</th>
            </tr>
          </thead>
          <tbody>
            {recommendations.map((r) => (
              <tr key={r.id}>
                <td style={{ fontWeight: 600 }}>{r.System}</td>
                <td>{r.Planet}</td>
                <td>{r.PlanetType || "—"}</td>
                <td className="right">{r.Value.toFixed(2)}</td>
                <td className="right">
                  <span className={`chip ${r.inUse ? "good" : ""}`}>{r.inUse ? "Already extracting" : "Open"}</span>
                </td>
              </tr>
            ))}
            {!recommendations.length && (
              <tr>
                <td colSpan={5} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                  No recommendations yet. Pick a Resource in Heatmap (or import scans).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
