import React, { useEffect, useMemo, useState } from "react";
import { YieldLog } from "../types";
import { n, s } from "../lib/utils";
import { fetchMarketSnapshot, resolveHub, resolveNamesToIds, HubResolved, MarketSnapshot } from "../lib/esiMarket";
import { janiceFetchMarkets, janicePriceItems, JaniceMarket } from "../lib/janice";

type HubConfig = { name: string };
type Provider = "esi" | "janice";
type JaniceCfg = { apiKey: string; marketAId: number; marketBId: number };
type PriceRow = {
  product: string;
  amount: number;
  typeId: number | null;
  hubA?: MarketSnapshot;
  hubB?: MarketSnapshot;
  error?: string;
  updatedAt?: string;
};

const LS_MARKET = "pi_tracker_market_v1";

function loadMarketConfig(): { provider: Provider; hubA: HubConfig; hubB: HubConfig; janice: JaniceCfg } {
  try {
    const raw = localStorage.getItem(LS_MARKET);
    if (!raw)
      return {
        provider: "esi",
        hubA: { name: "Jita" },
        hubB: { name: "C-N4OD" },
        janice: { apiKey: "", marketAId: 2, marketBId: 0 },
      };
    const obj = JSON.parse(raw);
    return {
      provider: (s(obj?.provider) as Provider) || "esi",
      hubA: { name: s(obj?.hubA?.name) || "Jita" },
      hubB: { name: s(obj?.hubB?.name) || "C-N4OD" },
      janice: {
        apiKey: s(obj?.janice?.apiKey),
        marketAId: Math.max(0, n(obj?.janice?.marketAId) ?? 2),
        marketBId: Math.max(0, n(obj?.janice?.marketBId) ?? 0),
      },
    };
  } catch {
    return {
      provider: "esi",
      hubA: { name: "Jita" },
      hubB: { name: "C-N4OD" },
      janice: { apiKey: "", marketAId: 2, marketBId: 0 },
    };
  }
}

function saveMarketConfig(cfg: { provider: Provider; hubA: HubConfig; hubB: HubConfig; janice: JaniceCfg }) {
  try {
    localStorage.setItem(LS_MARKET, JSON.stringify(cfg));
  } catch {
    // ignore
  }
}

function fmtISK(v: number | null) {
  if (v === null) return "—";
  return `${v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} isk`;
}

function fmtNum(v: number) {
  return v.toLocaleString();
}

function pct(a: number | null, b: number | null) {
  if (a === null || b === null || b === 0) return null;
  return (a / b) * 100;
}

function isoNow() {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export default function MarketTab({ yields }: { yields: YieldLog[] }) {
  const [cfg, setCfg] = useState(() => loadMarketConfig());
  const [hubAResolved, setHubAResolved] = useState<HubResolved | null>(null);
  const [hubBResolved, setHubBResolved] = useState<HubResolved | null>(null);
  const [janiceMarkets, setJaniceMarkets] = useState<JaniceMarket[]>([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string>("");
  const [rows, setRows] = useState<PriceRow[]>([]);
  const [maxItems, setMaxItems] = useState("12");
  const [maxPages, setMaxPages] = useState("200");

  useEffect(() => {
    saveMarketConfig(cfg);
  }, [cfg]);

  const latestByProduct = useMemo(() => {
    if (!yields.length) return [] as { product: string; amount: number; date: string }[];
    const latestDate = yields.reduce((m, y) => (y.Date > m ? y.Date : m), yields[0].Date);
    const m = new Map<string, number>();
    for (const y of yields) {
      if (y.Date !== latestDate) continue;
      m.set(y.Product, (m.get(y.Product) ?? 0) + y.Amount);
    }
    return Array.from(m.entries())
      .map(([product, amount]) => ({ product, amount, date: latestDate }))
      .sort((a, b) => b.amount - a.amount);
  }, [yields]);

  const selectedProducts = useMemo(() => {
    const limit = Math.max(1, Math.min(50, n(maxItems) ?? 12));
    return latestByProduct.slice(0, limit);
  }, [latestByProduct, maxItems]);

  async function resolveHubs() {
    if (cfg.provider !== "esi") {
      setHubAResolved(null);
      setHubBResolved(null);
      return null;
    }
    setErr("");
    setBusy(true);
    try {
      const [a, b] = await Promise.all([resolveHub(cfg.hubA.name), resolveHub(cfg.hubB.name)]);
      setHubAResolved(a);
      setHubBResolved(b);
      return { a, b };
    } catch (e: any) {
      setErr(e?.message ?? "Failed to resolve hubs.");
      setHubAResolved(null);
      setHubBResolved(null);
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function loadJaniceMarkets() {
    setErr("");
    setBusy(true);
    try {
      const apiKey = s(cfg.janice.apiKey);
      if (!apiKey) throw new Error("Enter your Janice X-ApiKey first.");
      const markets = await janiceFetchMarkets(apiKey);
      setJaniceMarkets(markets);
      // Auto-set common defaults if missing
      const jita = markets.find((m) => (m.name || "").toLowerCase().includes("jita"));
      const cn = markets.find((m) => (m.name || "").toLowerCase().includes("c-n4od"));
      setCfg((c) => ({
        ...c,
        janice: {
          ...c.janice,
          marketAId: c.janice.marketAId || jita?.id || 2,
          marketBId: c.janice.marketBId || cn?.id || c.janice.marketBId,
        },
      }));
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load Janice markets.");
      setJaniceMarkets([]);
    } finally {
      setBusy(false);
    }
  }

  async function refreshPrices() {
    setErr("");
    if (!selectedProducts.length) {
      setErr("No yield logs found. Add some totals in Yield Tracker first.");
      return;
    }

    setBusy(true);
    try {
      if (cfg.provider === "janice") {
        const apiKey = s(cfg.janice.apiKey);
        if (!apiKey) throw new Error("Enter your Janice X-ApiKey first.");
        if (!cfg.janice.marketAId || !cfg.janice.marketBId) throw new Error("Select both Janice markets.");

        const items = selectedProducts.map((p) => p.product);
        const initial: PriceRow[] = selectedProducts.map((p) => ({
          product: p.product,
          amount: p.amount,
          typeId: null,
        }));
        setRows(initial);

        const [aPrices, bPrices] = await Promise.all([
          janicePriceItems(apiKey, cfg.janice.marketAId, items),
          janicePriceItems(apiKey, cfg.janice.marketBId, items),
        ]);

        const mapByName = (arr: any[]) => {
          const m = new Map<string, any>();
          for (const it of arr) {
            const name = s(it?.itemType?.name);
            if (name) m.set(name, it);
          }
          return m;
        };

        const aMap = mapByName(aPrices);
        const bMap = mapByName(bPrices);

        const next: PriceRow[] = initial.map((r) => {
          const ai = aMap.get(r.product);
          const bi = bMap.get(r.product);
          const hubA: MarketSnapshot | undefined = ai
            ? {
                bestBuy: n(ai?.immediatePrices?.buyPrice),
                bestSell: n(ai?.immediatePrices?.sellPrice),
                buyVolume: Number(ai?.buyVolume ?? 0),
                sellVolume: Number(ai?.sellVolume ?? 0),
                truncated: false,
                scannedPages: 0,
              }
            : undefined;
          const hubB: MarketSnapshot | undefined = bi
            ? {
                bestBuy: n(bi?.immediatePrices?.buyPrice),
                bestSell: n(bi?.immediatePrices?.sellPrice),
                buyVolume: Number(bi?.buyVolume ?? 0),
                sellVolume: Number(bi?.sellVolume ?? 0),
                truncated: false,
                scannedPages: 0,
              }
            : undefined;

          return {
            ...r,
            hubA,
            hubB,
            error: !hubA || !hubB ? "missing item price" : undefined,
            updatedAt: isoNow(),
          };
        });
        setRows(next);
      } else {
        const hubs = hubAResolved && hubBResolved ? { a: hubAResolved, b: hubBResolved } : await resolveHubs();
        if (!hubs) return;

        const names = selectedProducts.map((p) => p.product);
        const ids = await resolveNamesToIds(names);

        const initial: PriceRow[] = selectedProducts.map((p) => ({
          product: p.product,
          amount: p.amount,
          typeId: ids.get(p.product) ?? null,
        }));
        setRows(initial);

        const next: PriceRow[] = [];
        const pageLimit = Math.max(1, Math.min(500, n(maxPages) ?? 50));

        for (const r of initial) {
          if (!r.typeId) {
            next.push({ ...r, error: "typeId not found", updatedAt: isoNow() });
            setRows([...next, ...initial.slice(next.length)]);
            continue;
          }

          try {
            const [pa, pb] = await Promise.all([
              fetchMarketSnapshot(hubs.a, r.typeId, { maxPages: pageLimit }),
              fetchMarketSnapshot(hubs.b, r.typeId, { maxPages: pageLimit }),
            ]);
            next.push({ ...r, hubA: pa, hubB: pb, updatedAt: isoNow() });
          } catch (e: any) {
            next.push({ ...r, error: e?.message ?? "price fetch failed", updatedAt: isoNow() });
          }
          setRows([...next, ...initial.slice(next.length)]);
        }
      }
    } finally {
      setBusy(false);
    }
  }

  const janiceNameFor = (id: number) => janiceMarkets.find((m) => m.id === id)?.name || null;
  const headerA =
    cfg.provider === "janice"
      ? janiceNameFor(cfg.janice.marketAId) || "Janice hub A"
      : hubAResolved?.name || cfg.hubA.name || "Hub A";
  const headerB =
    cfg.provider === "janice"
      ? janiceNameFor(cfg.janice.marketBId) || "Janice hub B"
      : hubBResolved?.name || cfg.hubB.name || "Hub B";

  return (
    <div className="grid cols-2">
      <div className="card">
        <h2>Market pricing</h2>
        <p>Pull best buy/sell prices for your latest yield totals.</p>
        <div className="grid" style={{ marginTop: 12 }}>
          <div className="grid cols-2">
            <div className="field">
              <label>Price source</label>
              <select
                value={cfg.provider}
                onChange={(e) => setCfg((c) => ({ ...c, provider: (e.target.value as Provider) || "esi" }))}
              >
                <option value="esi">ESI (public)</option>
                <option value="janice">Janice (API key)</option>
              </select>
              <small>Janice can surface staging hub markets that ESI cannot.</small>
            </div>
          </div>

          <div className="grid cols-2">
            <div className="field">
              <label>Hub A system</label>
              <input
                value={cfg.hubA.name}
                onChange={(e) => setCfg((c) => ({ ...c, hubA: { name: e.target.value } }))}
                placeholder="Jita"
                disabled={cfg.provider === "janice"}
              />
              <small>Example: Jita</small>
            </div>
            <div className="field">
              <label>Hub B system</label>
              <input
                value={cfg.hubB.name}
                onChange={(e) => setCfg((c) => ({ ...c, hubB: { name: e.target.value } }))}
                placeholder="C-N4OD"
                disabled={cfg.provider === "janice"}
              />
              <small>Example: C-N4OD</small>
            </div>
          </div>

          {cfg.provider === "janice" && (
            <div className="grid cols-2">
              <div className="field">
                <label>Janice X-ApiKey</label>
                <input
                  value={cfg.janice.apiKey}
                  onChange={(e) => setCfg((c) => ({ ...c, janice: { ...c.janice, apiKey: e.target.value } }))}
                  placeholder="X-ApiKey"
                  type="password"
                />
                <small>Stored in your browser localStorage (no server). For tighter security later, we can move to server-side proxy.</small>
              </div>
              <div className="field" style={{ justifyContent: "flex-end" }}>
                <div className="row" style={{ marginTop: 22 }}>
                  <button className="button" onClick={loadJaniceMarkets} disabled={busy}>
                    Load Janice markets
                  </button>
                </div>
              </div>
              <div className="field">
                <label>Janice market A</label>
                <select
                  value={String(cfg.janice.marketAId || 0)}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, janice: { ...c.janice, marketAId: Math.max(0, Number(e.target.value) || 0) } }))
                  }
                >
                  <option value="0">(select)</option>
                  {janiceMarkets.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.name || `market ${m.id}`}
                    </option>
                  ))}
                </select>
                <small>Default is 2 (Jita) in Janice.</small>
              </div>
              <div className="field">
                <label>Janice market B</label>
                <select
                  value={String(cfg.janice.marketBId || 0)}
                  onChange={(e) =>
                    setCfg((c) => ({ ...c, janice: { ...c.janice, marketBId: Math.max(0, Number(e.target.value) || 0) } }))
                  }
                >
                  <option value="0">(select)</option>
                  {janiceMarkets.map((m) => (
                    <option key={m.id} value={String(m.id)}>
                      {m.name || `market ${m.id}`}
                    </option>
                  ))}
                </select>
                <small>Pick the C-N4OD hub market here.</small>
              </div>
            </div>
          )}

          <div className="grid cols-2">
            <div className="field">
              <label>Products to price</label>
              <input value={maxItems} onChange={(e) => setMaxItems(e.target.value)} />
              <small>Uses your latest yield date; limits requests to avoid rate limits.</small>
            </div>
            <div className="field">
              <label>Max pages to scan</label>
              <input value={maxPages} onChange={(e) => setMaxPages(e.target.value)} />
              <small>Higher finds more hub orders, but can be slower.</small>
            </div>
            <div className="field" style={{ justifyContent: "flex-end" }}>
              <div className="row" style={{ marginTop: 22 }}>
                <button className="button" onClick={resolveHubs} disabled={busy || cfg.provider === "janice"}>
                  Resolve hubs
                </button>
                <button className="button primary" onClick={refreshPrices} disabled={busy}>
                  {busy ? "Loading…" : "Refresh prices"}
                </button>
              </div>
            </div>
          </div>

          {err && <div className="alert bad">{err}</div>}
          {cfg.provider === "esi" && (hubAResolved || hubBResolved) && (
            <div className="row" style={{ flexWrap: "wrap" }}>
              {hubAResolved && (
                <span className="chip">
                  {hubAResolved.name} • system {hubAResolved.systemId} • region {hubAResolved.regionId}
                </span>
              )}
              {hubBResolved && (
                <span className="chip">
                  {hubBResolved.name} • system {hubBResolved.systemId} • region {hubBResolved.regionId}
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="card">
        <h2>Latest yield date</h2>
        <p>
          {latestByProduct.length
            ? `${latestByProduct[0].date} • ${latestByProduct.length} products logged`
            : "No yield logs yet."}
        </p>
        {latestByProduct.length ? (
          <div style={{ marginTop: 10 }} className="row">
            {selectedProducts.slice(0, 6).map((x) => (
              <span key={x.product} className="chip">
                {x.product}: {fmtNum(x.amount)}
              </span>
            ))}
            {selectedProducts.length > 6 && <span className="chip">+{selectedProducts.length - 6} more</span>}
          </div>
        ) : null}
      </div>

      <div className="card" style={{ gridColumn: "1 / -1" }}>
        <h2>Prices</h2>
        <p>Best buy (what you can sell into) and best sell (what you’d pay).</p>
        <p className="sub" style={{ marginTop: 6 }}>
          {cfg.provider === "esi"
            ? "ESI only returns public market orders. If your hub is a private structure market (common in null staging), ESI may show no orders even though you can trade there in-game."
            : "Janice provides a consolidated market view and can surface some staging-hub markets."}
        </p>

        <div className="tableWrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Product</th>
                <th className="right">Amount</th>
                <th>{headerA} buy</th>
                <th>{headerA} sell</th>
                <th>{headerB} buy</th>
                <th>{headerB} sell</th>
                <th className="right">{headerB} sell vs {headerA} buy</th>
                <th>Action</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {(rows.length ? rows : selectedProducts.map((p) => ({ product: p.product, amount: p.amount, typeId: null } as PriceRow))).map((r) => {
                const aBuy = r.hubA?.bestBuy ?? null;
                const bBuy = r.hubB?.bestBuy ?? null;
                const bSell = r.hubB?.bestSell ?? null;
                const ratio = pct(bSell, aBuy);
                const ratioText = ratio === null ? "—" : `${ratio.toFixed(0)}%`;
                const chipClass = ratio === null ? "chip" : ratio >= 105 ? "chip good" : ratio <= 95 ? "chip bad" : "chip";

                let action = "—";
                if (aBuy !== null && bSell !== null) {
                  action = bSell > aBuy ? `Sell in ${headerB}` : "Make P2";
                } else if (bSell === null && aBuy !== null) {
                  action = `No ${headerB} sell`;
                } else if (aBuy === null && bSell !== null) {
                  action = `No ${headerA} buy`;
                }

                const note: string[] = [];
                if (r.error) note.push(r.error);
                if ((r.hubA?.bestBuy === null || r.hubA?.bestSell === null) && r.hubA?.truncated) note.push(`${headerA} missing orders (increase pages)`);
                if ((r.hubB?.bestBuy === null || r.hubB?.bestSell === null) && r.hubB?.truncated) note.push(`${headerB} missing orders (increase pages)`);
                if (r.hubA?.bestBuy === null && r.hubA?.truncated === false) note.push(`${headerA} has no public buy orders in this system`);
                if (r.hubA?.bestSell === null && r.hubA?.truncated === false) note.push(`${headerA} has no public sell orders in this system`);
                if (r.hubB?.bestBuy === null && r.hubB?.truncated === false) note.push(`${headerB} has no public buy orders in this system`);
                if (r.hubB?.bestSell === null && r.hubB?.truncated === false) note.push(`${headerB} has no public sell orders in this system (often private structure market)`);
                if (r.hubA?.truncated || r.hubB?.truncated) note.push("truncated pages");
                if (r.hubA?.scannedPages) note.push(`${headerA} scanned ${r.hubA.scannedPages}`);
                if (r.hubB?.scannedPages) note.push(`${headerB} scanned ${r.hubB.scannedPages}`);
                if (r.updatedAt) note.push(`updated ${r.updatedAt}`);
                return (
                  <tr key={r.product}>
                    <td>
                      <b>{r.product}</b>
                      {r.typeId ? <span className="sub">type {r.typeId}</span> : <span className="sub">type unknown</span>}
                    </td>
                    <td className="right">{fmtNum(r.amount)}</td>
                    <td>{fmtISK(aBuy)}</td>
                    <td>{fmtISK(r.hubA?.bestSell ?? null)}</td>
                    <td>{fmtISK(bBuy)}</td>
                    <td>{fmtISK(bSell)}</td>
                    <td className="right"><span className={chipClass}>{ratioText}</span></td>
                    <td>{action}</td>
                    <td>{note.length ? <span className="sub">{note.join(" • ")}</span> : <span className="sub">—</span>}</td>
                  </tr>
                );
              })}
              {!selectedProducts.length && (
                <tr>
                  <td colSpan={9} style={{ padding: 20, color: "var(--muted)" }}>
                    Add some yield logs first (Yield Tracker) so we know what to price.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
