import React, { useEffect, useMemo, useRef, useState } from "react";
import { AppState, Assignment, CharacterProfile, ScanCell } from "./types";
import { importAssignmentsXlsx } from "./lib/xlsxImport";
import { exportHeatmapJson, importHeatmapJson } from "./lib/heatmapJson";
import { downloadJson, heatColor, n, s, todayISO, uid } from "./lib/utils";
import { importStateFromJson, loadState, saveState, wipeState } from "./lib/storage";
import { parseYieldPaste } from "./lib/yieldParse";
import HeatmapTab from "./features/HeatmapTab";
import RecommendationsTab from "./features/RecommendationsTab";
import AssignmentsTab from "./features/AssignmentsTab";
import YieldsTab from "./features/YieldsTab";
import ExplorerTab from "./features/ExplorerTab";
import DashboardTab from "./features/DashboardTab";
import MarketTab from "./features/MarketTab";
import { Download, Upload } from "lucide-react";
import { clampSlots, mergeCharacters, nextOpenSlot, characterHasColonyOnPlanet } from "./lib/characters";

type TabKey = "heatmap" | "explorer" | "recs" | "assignments" | "yields" | "dashboard" | "market";

export default function App() {
  const [state, setState] = useState<AppState>(() => loadState());
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [status, setStatus] = useState<string>("");
  const [err, setErr] = useState<string>("");

  const xlsxRef = useRef<HTMLInputElement | null>(null);
  const heatmapRef = useRef<HTMLInputElement | null>(null);
  const importAllRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => saveState(state), [state]);

  const regions = useMemo(() => {
    const r = new Set<string>();
    state.scans.forEach((x) => r.add(x.Region || "Unknown"));
    state.assignments.forEach((x) => r.add(x.Region || "Unknown"));
    return Array.from(r).filter(Boolean).sort();
  }, [state.scans, state.assignments]);

  const allProducts = useMemo(() => {
    const set = new Set<string>();
    state.assignments.forEach((a) => set.add(a.Resource));
    state.scans.forEach((a) => set.add(a.Resource));
    state.yields.forEach((a) => set.add(a.Product));
    return Array.from(set).filter(Boolean).sort();
  }, [state]);

  const [hmRegion, setHmRegion] = useState<string>(regions[0] ?? "Delve");
  useEffect(() => {
    if (regions.length && !regions.includes(hmRegion)) setHmRegion(regions[0]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [regions.join("|")]);

  const constellations = useMemo(() => {
    const c = new Set<string>();
    state.scans
      .filter((x) => (x.Region || "Unknown") === hmRegion)
      .forEach((x) => {
        const v = s(x.Constellation);
        if (v) c.add(v);
      });

    if (c.size === 0) {
      state.assignments
        .filter((x) => (x.Region || "Unknown") === hmRegion)
        .forEach((x) => {
          const v = s(x.Constellation);
          if (v) c.add(v);
        });
    }

    return Array.from(c).sort();
  }, [state.scans, state.assignments, hmRegion]);

  const [hmConst, setHmConst] = useState<string>("");
  useEffect(() => {
    if (hmConst && constellations.length && !constellations.includes(hmConst)) setHmConst("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [constellations.join("|")]);

  const resources = useMemo(() => {
    const r = new Set<string>();
    state.scans
      .filter((x) => (x.Region || "Unknown") === hmRegion && (!hmConst || x.Constellation === hmConst))
      .forEach((x) => {
        const v = s(x.Resource);
        if (v) r.add(v);
      });

    if (r.size === 0) {
      state.assignments
        .filter((x) => (x.Region || "Unknown") === hmRegion && (!hmConst || x.Constellation === hmConst))
        .forEach((x) => {
          const v = s(x.Resource);
          if (v) r.add(v);
        });
    }

    return Array.from(r).sort();
  }, [state.scans, state.assignments, hmRegion, hmConst]);

  const [hmResource, setHmResource] = useState<string>("");
  useEffect(() => {
    if (hmResource && resources.length && !resources.includes(hmResource)) setHmResource("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resources.join("|")]);

  const scanFiltered = useMemo(() => {
    return state.scans.filter((x) => {
      if ((x.Region || "Unknown") !== hmRegion) return false;
      if (hmConst && x.Constellation !== hmConst) return false;
      if (hmResource && x.Resource !== hmResource) return false;
      return true;
    });
  }, [state.scans, hmRegion, hmConst, hmResource]);

  const scanMinMax = useMemo(() => {
    const vals = scanFiltered.map((x) => x.Value);
    return {
      min: vals.length ? Math.min(...vals) : 0,
      max: vals.length ? Math.max(...vals) : 1,
      count: vals.length,
    };
  }, [scanFiltered]);

  const heatRows = useMemo(() => {
    const bySystem = new Map<string, Map<string, ScanCell>>();
    for (const x of scanFiltered) {
      const sys = x.System;
      if (!sys) continue;
      if (!bySystem.has(sys)) bySystem.set(sys, new Map());
      const mp = bySystem.get(sys)!;
      const key = x.Planet;
      const ex = mp.get(key);
      if (!ex || x.Value > ex.Value) mp.set(key, x);
    }

    const out: { System: string; planets: ScanCell[] }[] = [];
    for (const [System, mp] of bySystem.entries()) {
      const planets = Array.from(mp.values()).sort((a, b) => a.Planet.localeCompare(b.Planet, undefined, { numeric: true }));
      out.push({ System, planets });
    }
    out.sort((a, b) => a.System.localeCompare(b.System));
    return out;
  }, [scanFiltered]);

  const inUseKeys = useMemo(() => {
    const set = new Set<string>();
    for (const a of state.assignments) {
      set.add(`${a.Region}|${a.Constellation}|${a.System}|${a.Planet}|${a.Resource}`);
    }
    return set;
  }, [state.assignments]);

  const recommendations = useMemo(() => {
    const best = new Map<string, ScanCell>();
    for (const x of scanFiltered) {
      const k = `${x.Region}|${x.Constellation}|${x.System}|${x.Planet}|${x.Resource}`;
      const ex = best.get(k);
      if (!ex || x.Value > ex.Value) best.set(k, x);
    }
    return Array.from(best.values())
      .sort((a, b) => b.Value - a.Value)
      .slice(0, 15)
      .map((x) => ({
        ...x,
        inUse: inUseKeys.has(`${x.Region}|${x.Constellation}|${x.System}|${x.Planet}|${x.Resource}`),
      }));
  }, [scanFiltered, inUseKeys]);

  const [draft, setDraft] = useState<Omit<Assignment, "id">>({
    Character: "",
    Slot: null,
    Region: "Delve",
    Constellation: "",
    System: "",
    Planet: "P1",
    PlanetType: "",
    Resource: "",
    Active: true,
    Notes: "",
  });

  useEffect(() => {
    if (!draft.Character && state.characters?.length) {
      setDraft((d) => ({ ...d, Character: state.characters[0].name, Slot: null }));
    }
  }, [state.characters, draft.Character]);

  async function onImportAssignments(file: File) {
    setErr("");
    setStatus("Importing assignments…");
    try {
      const { assignments, characters } = await importAssignmentsXlsx(file);
      setState((prev) => ({
        ...prev,
        assignments,
        characters: mergeCharacters(prev.characters ?? [], characters ?? []),
      }));
      setStatus(`Imported ${assignments.length} assignments.`);
    } catch (e: any) {
      setErr(e?.message ?? "Import failed.");
      setStatus("");
    }
  }

  async function onImportHeatmap(file: File) {
    setErr("");
    setStatus("Importing heatmap JSON…");
    try {
      const { region, scans } = await importHeatmapJson(file);
      setState((prev) => ({
        ...prev,
        scans: [...prev.scans.filter((x) => (x.Region || "Unknown") !== region), ...scans],
      }));
      setStatus(`Imported ${scans.length} scan cells for ${region}.`);
    } catch (e: any) {
      setErr(e?.message ?? "Heatmap JSON import failed.");
      setStatus("");
    }
  }

  function exportAll() {
    downloadJson(`pi-tracker_${todayISO()}.json`, state);
  }

  function wipe() {
    setState(wipeState());
    setStatus("Cleared local data.");
    setErr("");
  }

  function addAssignment() {
    const characterName = draft.Character.trim();
    const system = draft.System.trim();
    const planet = draft.Planet.trim();
    const resource = draft.Resource.trim();
    if (!characterName || !system || !planet || !resource) return;

    setErr("");
    setStatus("");

    setState((prev) => {
      const chars = Array.isArray(prev.characters) ? prev.characters : [];
      const existingChar = chars.find((c) => c.name === characterName);
      const slotsTotal = clampSlots(existingChar?.slotsTotal ?? (typeof draft.Slot === "number" ? draft.Slot : 1));

      if (characterHasColonyOnPlanet(prev.assignments, characterName, system, planet)) {
        setErr(`"${characterName}" already has a colony on ${system} ${planet}. One colony per planet per character.`);
        return prev;
      }

      const slotFromDraft = typeof draft.Slot === "number" && Number.isFinite(draft.Slot) ? Math.trunc(draft.Slot) : null;
      const slot = slotFromDraft ?? nextOpenSlot(prev.assignments, characterName, slotsTotal);
      if (!slot) {
        setErr(`No open slots left for "${characterName}" (configured slots: ${slotsTotal}).`);
        return prev;
      }

      const slotCollision = prev.assignments.some((a) => a.Character === characterName && a.Slot === slot);
      if (slotCollision) {
        const next = nextOpenSlot(prev.assignments, characterName, slotsTotal);
        if (!next) {
          setErr(`Slot ${slot} is already used for "${characterName}", and no other slots are open.`);
          return prev;
        }
        setStatus(`Slot ${slot} was already used for "${characterName}"; using slot ${next} instead.`);
      }

      const finalSlot = slotCollision ? (nextOpenSlot(prev.assignments, characterName, slotsTotal) ?? slot) : slot;

      const nextCharacters: CharacterProfile[] = existingChar
        ? chars.map((c) => (c.name === characterName ? { ...c, slotsTotal: Math.max(clampSlots(c.slotsTotal), slotsTotal) } : c))
        : [...chars, { id: uid("c"), name: characterName, slotsTotal }].sort((a, b) => a.name.localeCompare(b.name));

      return {
        ...prev,
        characters: nextCharacters,
        assignments: [...prev.assignments, { ...draft, Character: characterName, System: system, Planet: planet, Resource: resource, Slot: finalSlot, id: uid("a") }],
      };
    });

    setDraft((d) => ({ ...d, System: "", Planet: "P1", PlanetType: "", Resource: "", Slot: null }));
  }

  function toggleAssignment(id: string) {
    setState((prev) => ({
      ...prev,
      assignments: prev.assignments.map((a) => (a.id === id ? { ...a, Active: !a.Active } : a)),
    }));
  }

  function delAssignment(id: string) {
    setState((prev) => ({ ...prev, assignments: prev.assignments.filter((a) => a.id !== id) }));
  }

  function upsertCharacter(name: string, slotsTotal: number) {
    const nm = name.trim();
    if (!nm) return;
    const slots = clampSlots(slotsTotal);
    setState((prev) => ({
      ...prev,
      characters: mergeCharacters(prev.characters ?? [], [{ id: uid("c"), name: nm, slotsTotal: slots } as CharacterProfile]),
    }));
  }

  function updateCharacterSlots(name: string, slotsTotal: number) {
    const nm = name.trim();
    if (!nm) return;
    const slots = clampSlots(slotsTotal);
    setState((prev) => ({
      ...prev,
      characters: (prev.characters ?? []).map((c) => (c.name === nm ? { ...c, slotsTotal: slots } : c)),
    }));
  }

  function addYieldOne(date: string, product: string, amount: number) {
    setState((prev) => ({
      ...prev,
      yields: [...prev.yields, { id: uid("y"), Date: date, Product: product, Amount: amount }].sort((a, b) => a.Date.localeCompare(b.Date)),
    }));
  }

  function addYieldBulk(date: string, paste: string) {
    const parsed = parseYieldPaste(paste, date);
    if (!parsed.length) return;
    setState((prev) => ({
      ...prev,
      yields: [...prev.yields, ...parsed.map((p) => ({ ...p, id: uid("y") }))].sort((a, b) => a.Date.localeCompare(b.Date)),
    }));
  }

  function delYield(id: string) {
    setState((prev) => ({ ...prev, yields: prev.yields.filter((y) => y.id !== id) }));
  }

  return (
    <div className="container">
      <div className="header">
        <div>
          <div className="brand">
            <div className="pill"><b>PI Tracker</b> <span style={{ color: "var(--muted)" }}>local-first</span></div>
            <span className="badge">Vite + React</span>
          </div>
          <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 13 }}>
            Import assignments (XLSX) + heatmap (JSON) → track assignments + paste yield totals.
          </div>
        </div>

        <div className="row">
          <input
            ref={xlsxRef}
            type="file"
            accept=".xlsx,.xls"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onImportAssignments(f);
              e.currentTarget.value = "";
            }}
          />
          <input
            ref={heatmapRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) await onImportHeatmap(f);
              e.currentTarget.value = "";
            }}
          />
          <input
            ref={importAllRef}
            type="file"
            accept=".json,application/json"
            style={{ display: "none" }}
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const text = await f.text();
                const parsed = JSON.parse(text);
                const next = importStateFromJson(parsed);
                setState(next);
                setStatus("Imported backup JSON.");
                setErr("");
              } catch (ex: any) {
                setErr(ex?.message ?? "Import failed.");
                setStatus("");
              } finally {
                e.currentTarget.value = "";
              }
            }}
          />

          <button className="button" onClick={() => xlsxRef.current?.click()}>
            <Upload size={16} /> Import Assignments (XLSX)
          </button>
          <button className="button" onClick={() => heatmapRef.current?.click()}>
            <Upload size={16} /> Import Heatmap (JSON)
          </button>
          <button className="button" onClick={() => importAllRef.current?.click()}>
            <Upload size={16} /> Import All (JSON)
          </button>
          <button className="button" onClick={exportAll}>
            <Download size={16} /> Export All (JSON)
          </button>
          <button className="button ghost" onClick={wipe}>Clear local</button>
        </div>
      </div>

      {(status || err) && (
        <div className="grid cols-2" style={{ marginTop: 14 }}>
          {status && <div className="alert good">{status}</div>}
          {err && <div className="alert bad">{err}</div>}
        </div>
      )}

      <div style={{ marginTop: 14 }}>
        <div className="tabs">
          <button className={`tab ${tab === "dashboard" ? "active" : ""}`} onClick={() => setTab("dashboard")}>Dashboard</button>
          <button className={`tab ${tab === "market" ? "active" : ""}`} onClick={() => setTab("market")}>Market</button>
          <button className={`tab ${tab === "explorer" ? "active" : ""}`} onClick={() => setTab("explorer")}>Explorer</button>
          <button className={`tab ${tab === "heatmap" ? "active" : ""}`} onClick={() => setTab("heatmap")}>Heatmap</button>
          <button className={`tab ${tab === "recs" ? "active" : ""}`} onClick={() => setTab("recs")}>Recommendations</button>
          <button className={`tab ${tab === "assignments" ? "active" : ""}`} onClick={() => setTab("assignments")}>Assignments</button>
          <button className={`tab ${tab === "yields" ? "active" : ""}`} onClick={() => setTab("yields")}>Yield Tracker</button>
        </div>

        <div style={{ marginTop: 12 }}>
          {tab === "dashboard" && (
            <DashboardTab
              regions={regions}
              hmRegion={hmRegion}
              setHmRegion={setHmRegion}
              assignments={state.assignments}
              yields={state.yields}
            />
          )}

          {tab === "market" && (
            <MarketTab yields={state.yields} />
          )}

          {tab === "explorer" && (
            <ExplorerTab
              regions={regions}
              hmRegion={hmRegion}
              setHmRegion={setHmRegion}
              constellations={constellations}
              hmConst={hmConst}
              setHmConst={setHmConst}
              scans={state.scans}
              assignments={state.assignments}
            />
          )}

          {tab === "heatmap" && (
            <HeatmapTab
              regions={regions}
              hmRegion={hmRegion}
              setHmRegion={setHmRegion}
              constellations={constellations}
              hmConst={hmConst}
              setHmConst={setHmConst}
              resources={resources}
              hmResource={hmResource}
              setHmResource={setHmResource}
              scanMinMax={scanMinMax}
              heatRows={heatRows}
              inUseKeys={inUseKeys}
              onExportRegion={() => exportHeatmapJson(hmRegion, state.scans)}
              exportDisabled={!state.scans.some((x) => (x.Region || "Unknown") === hmRegion)}
            />
          )}

          {tab === "recs" && (
            <RecommendationsTab recommendations={recommendations} />
          )}

          {tab === "assignments" && (
            <AssignmentsTab
              draft={draft}
              setDraft={setDraft}
              allProducts={allProducts}
              assignments={state.assignments}
              characters={state.characters}
              onAdd={addAssignment}
              onToggle={toggleAssignment}
              onDelete={delAssignment}
              onUpsertCharacter={upsertCharacter}
              onUpdateCharacterSlots={updateCharacterSlots}
            />
          )}

          {tab === "yields" && (
            <YieldsTab
              allProducts={allProducts}
              yields={state.yields}
              onAddOne={(date, product, amountStr) => {
                const amt = n(amountStr);
                if (!product.trim() || amt === null) return false;
                addYieldOne(date, product.trim(), amt);
                return true;
              }}
              onBulk={(date, paste) => addYieldBulk(date, paste)}
              onDelete={delYield}
            />
          )}
        </div>
      </div>

      <div style={{ marginTop: 14, color: "var(--muted)", fontSize: 12 }}>
        Tip: your Delve sample heatmap is in <span className="chip">public/heatmap-delve.json</span> (use Import Heatmap).
      </div>
    </div>
  );
}
