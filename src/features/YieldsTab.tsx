import React, { useState } from "react";

export default function YieldsTab(props: {
  allProducts: string[];
  yields: Array<{ id: string; Date: string; Product: string; Amount: number }>;
  onAddOne: (date: string, product: string, amountStr: string) => boolean;
  onBulk: (date: string, paste: string) => void;
  onDelete: (id: string) => void;
}) {
  const { allProducts, yields, onAddOne, onBulk, onDelete } = props;

  const [date, setDate] = useState(() => {
    const d = new Date();
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}`;
  });
  const [product, setProduct] = useState("");
  const [amount, setAmount] = useState("");
  const [paste, setPaste] = useState("");

  return (
    <div className="card">
      <h2>Yield Tracker</h2>
      <p>Paste totals (combined across all characters) to track drift over time.</p>

      <div className="grid cols-2" style={{ marginTop: 12 }}>
        <div className="grid">
          <div className="field">
            <label>Date</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>

          <div className="card" style={{ background: "rgba(2,6,23,.35)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>Add one</b>
              <span className="badge">product + amount</span>
            </div>

            <div className="grid cols-2" style={{ marginTop: 10 }}>
              <div className="field">
                <label>Product</label>
                <select value={product || "__pick"} onChange={(e) => setProduct(e.target.value === "__pick" ? "" : e.target.value)}>
                  <option value="__pick">(pick)</option>
                  {allProducts.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Amount</label>
                <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 12000" />
              </div>
            </div>

            <button
              className="button primary"
              style={{ marginTop: 10 }}
              onClick={() => {
                const ok = onAddOne(date, product, amount);
                if (ok) setAmount("");
              }}
            >
              Add log
            </button>
          </div>

          <div className="card" style={{ background: "rgba(2,6,23,.35)" }}>
            <div className="row" style={{ justifyContent: "space-between" }}>
              <b>Paste many</b>
              <span className="badge">tab / comma</span>
            </div>
            <textarea
              value={paste}
              onChange={(e) => setPaste(e.target.value)}
              placeholder={"Biofuels\t12000\n2026-01-31, Toxic Metals, 9100"}
              style={{ marginTop: 10 }}
            />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <small>Uses the date above if your line doesn’t include a date.</small>
              <button
                className="button"
                onClick={() => {
                  if (!paste.trim()) return;
                  onBulk(date, paste);
                  setPaste("");
                }}
              >
                Add pasted logs
              </button>
            </div>
          </div>
        </div>

        <div>
          <div className="tableWrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Product</th>
                  <th className="right">Amount</th>
                  <th className="right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {yields.map((y) => (
                  <tr key={y.id}>
                    <td style={{ fontVariantNumeric: "tabular-nums" }}>{y.Date}</td>
                    <td><span className="chip">{y.Product}</span></td>
                    <td className="right" style={{ fontVariantNumeric: "tabular-nums" }}>{y.Amount.toLocaleString()}</td>
                    <td className="right">
                      <button className="button ghost" onClick={() => onDelete(y.id)}>Delete</button>
                    </td>
                  </tr>
                ))}
                {!yields.length && (
                  <tr>
                    <td colSpan={4} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                      No yield logs yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div style={{ marginTop: 10, color: "var(--muted)", fontSize: 12 }}>
            Export All (JSON) includes yield logs too.
          </div>
        </div>
      </div>
    </div>
  );
}
