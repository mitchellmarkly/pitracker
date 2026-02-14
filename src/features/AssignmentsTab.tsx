import React, { useEffect, useMemo, useState } from "react";
import { Assignment, CharacterProfile } from "../types";
import { n, s } from "../lib/utils";
import { characterHasColonyOnPlanet, clampSlots, nextOpenSlot, usedSlots } from "../lib/characters";

export default function AssignmentsTab(props: {
  draft: Omit<Assignment, "id">;
  setDraft: React.Dispatch<React.SetStateAction<Omit<Assignment, "id">>>;
  allProducts: string[];
  assignments: Assignment[];
  characters: CharacterProfile[];
  onAdd: () => void;
  onToggle: (id: string) => void;
  onDelete: (id: string) => void;
  onUpsertCharacter: (name: string, slotsTotal: number) => void;
  onUpdateCharacterSlots: (name: string, slotsTotal: number) => void;
}) {
  const {
    draft,
    setDraft,
    allProducts,
    assignments,
    characters,
    onAdd,
    onToggle,
    onDelete,
    onUpsertCharacter,
    onUpdateCharacterSlots,
  } = props;

  const [selectedCharacter, setSelectedCharacter] = useState<string>("");
  const [newCharName, setNewCharName] = useState<string>("");
  const [newCharSlots, setNewCharSlots] = useState<string>("6");

  useEffect(() => {
    if (!selectedCharacter && characters.length) setSelectedCharacter(characters[0].name);
  }, [characters, selectedCharacter]);

  const charactersByName = useMemo(() => {
    const m = new Map<string, CharacterProfile>();
    for (const c of characters) m.set(c.name, c);
    return m;
  }, [characters]);

  const draftSlotsTotal = useMemo(() => {
    const c = charactersByName.get(draft.Character || "");
    return clampSlots(c?.slotsTotal ?? 1);
  }, [charactersByName, draft.Character]);

  useEffect(() => {
    const name = draft.Character?.trim();
    if (!name) return;
    if (draft.Slot !== null && draft.Slot !== undefined) return;
    const next = nextOpenSlot(assignments, name, draftSlotsTotal);
    if (!next) return;
    setDraft((d) => ({ ...d, Slot: next }));
  }, [assignments, draft.Character, draft.Slot, draftSlotsTotal, setDraft]);

  const colonyConflict = useMemo(() => {
    const name = draft.Character?.trim();
    const system = draft.System?.trim();
    const planet = draft.Planet?.trim();
    if (!name || !system || !planet) return false;
    return characterHasColonyOnPlanet(assignments, name, system, planet);
  }, [assignments, draft.Character, draft.System, draft.Planet]);

  const slotConflict = useMemo(() => {
    const name = draft.Character?.trim();
    const slot = typeof draft.Slot === "number" ? Math.trunc(draft.Slot) : null;
    if (!name || !slot) return false;
    return assignments.some((a) => a.Character === name && a.Slot === slot);
  }, [assignments, draft.Character, draft.Slot]);

  const filteredAssignments = useMemo(() => {
    const name = selectedCharacter?.trim();
    if (!name) return assignments;
    return assignments.filter((a) => a.Character === name);
  }, [assignments, selectedCharacter]);

  const usedSlotsForSelected = useMemo(() => {
    const name = selectedCharacter?.trim();
    if (!name) return new Set<number>();
    return usedSlots(assignments, name);
  }, [assignments, selectedCharacter]);

  return (
    <div className="grid cols-3">
      <div className="card">
        <h2>Characters</h2>
        <p>Add characters and how many planets they can run (slots).</p>

        <div className="grid" style={{ marginTop: 12 }}>
          <div className="grid cols-2" style={{ gap: 8 }}>
            <div className="field">
              <label>New character</label>
              <input value={newCharName} onChange={(e) => setNewCharName(e.target.value)} placeholder="Name" />
            </div>
            <div className="field">
              <label>Slots</label>
              <input value={newCharSlots} onChange={(e) => setNewCharSlots(e.target.value)} placeholder="6" />
            </div>
          </div>

          <button
            className="button"
            onClick={() => {
              const name = newCharName.trim();
              const slots = clampSlots(n(newCharSlots) ?? 6);
              if (!name) return;
              onUpsertCharacter(name, slots);
              setNewCharName("");
              setNewCharSlots("6");
              if (!selectedCharacter) setSelectedCharacter(name);
            }}
          >
            Add character
          </button>

          <div className="tableWrap" style={{ marginTop: 10 }}>
            <table>
              <thead>
                <tr>
                  <th>Character</th>
                  <th className="right">Slots</th>
                  <th className="right">Used</th>
                </tr>
              </thead>
              <tbody>
                {characters.map((c) => {
                  const used = usedSlots(assignments, c.name).size;
                  return (
                    <tr
                      key={c.id}
                      style={{ cursor: "pointer" }}
                      onClick={() => setSelectedCharacter(c.name)}
                    >
                      <td style={{ fontWeight: selectedCharacter === c.name ? 900 : 600 }}>
                        {c.name}
                      </td>
                      <td className="right">
                        <input
                          style={{ width: 64, textAlign: "right" }}
                          value={String(c.slotsTotal)}
                          onChange={(e) => {
                            const slots = clampSlots(n(e.target.value) ?? c.slotsTotal);
                            onUpdateCharacterSlots(c.name, slots);
                          }}
                        />
                      </td>
                      <td className="right">
                        <span className="chip">{used}/{clampSlots(c.slotsTotal)}</span>
                      </td>
                    </tr>
                  );
                })}

                {!characters.length && (
                  <tr>
                    <td colSpan={3} style={{ padding: 14, textAlign: "center", color: "var(--muted)" }}>
                      No characters yet. Import assignments or add one.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <h2>Add assignment</h2>
        <p>Pick a character, the next open slot is selected automatically.</p>

        <div className="grid" style={{ marginTop: 12 }}>
          <div className="field">
            <label>Character</label>
            <select
              value={draft.Character || "__pick"}
              onChange={(e) => {
                const val = e.target.value;
                setDraft((d) => ({ ...d, Character: val === "__pick" ? "" : val, Slot: null }));
              }}
            >
              <option value="__pick">(pick)</option>
              {characters.map((c) => (
                <option key={c.id} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid cols-2">
            <div className="field">
              <label>Slot</label>
              <input
                value={(draft.Slot ?? "").toString()}
                onChange={(e) => setDraft((d) => ({ ...d, Slot: n(e.target.value) ?? null }))}
                placeholder={draft.Character ? String(nextOpenSlot(assignments, draft.Character, draftSlotsTotal) ?? "") : ""}
              />
              {draft.Character && (
                <small>
                  Open: {(() => {
                    const total = draftSlotsTotal;
                    const used = usedSlots(assignments, draft.Character);
                    const open: number[] = [];
                    for (let i = 1; i <= total; i++) if (!used.has(i)) open.push(i);
                    return open.length ? open.join(", ") : "none";
                  })()}
                </small>
              )}
            </div>
            <div className="field">
              <label>Region</label>
              <input value={draft.Region} onChange={(e) => setDraft((d) => ({ ...d, Region: e.target.value }))} />
            </div>
          </div>

          <div className="field">
            <label>Constellation</label>
            <input value={draft.Constellation} onChange={(e) => setDraft((d) => ({ ...d, Constellation: e.target.value }))} />
          </div>

          <div className="field">
            <label>System</label>
            <input value={draft.System} onChange={(e) => setDraft((d) => ({ ...d, System: e.target.value }))} />
          </div>

          <div className="grid cols-2">
            <div className="field">
              <label>Planet</label>
              <input value={draft.Planet} onChange={(e) => setDraft((d) => ({ ...d, Planet: e.target.value }))} />
            </div>
            <div className="field">
              <label>Planet type</label>
              <input value={draft.PlanetType} onChange={(e) => setDraft((d) => ({ ...d, PlanetType: e.target.value }))} />
            </div>
          </div>

          <div className="field">
            <label>Resource</label>
            <select
              value={draft.Resource || "__pick"}
              onChange={(e) => setDraft((d) => ({ ...d, Resource: e.target.value === "__pick" ? "" : e.target.value }))}
            >
              <option value="__pick">(pick)</option>
              {allProducts.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            <small>Resources populate from your heatmap + existing assignments.</small>
          </div>

          {(colonyConflict || slotConflict) && (
            <div className="alert bad" style={{ marginTop: 6 }}>
              {colonyConflict && (
                <div>
                  This character already has a colony on {draft.System.trim()} {draft.Planet.trim()}.
                </div>
              )}
              {slotConflict && <div>That slot is already used by this character.</div>}
            </div>
          )}

          <button className="button primary" disabled={colonyConflict || slotConflict} onClick={onAdd}>
            Add assignment
          </button>
        </div>
      </div>

      <div className="card">
        <h2>Assignments</h2>
        <p>Per-character view. Click a character in the left panel to filter.</p>

        <div className="field" style={{ marginTop: 10 }}>
          <label>View</label>
          <select value={selectedCharacter || "__all"} onChange={(e) => setSelectedCharacter(e.target.value === "__all" ? "" : e.target.value)}>
            <option value="__all">All characters</option>
            {characters.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {selectedCharacter && (
          <div style={{ marginTop: 8, color: "var(--muted)", fontSize: 12 }}>
            Used slots: {Array.from(usedSlotsForSelected.values()).sort((a, b) => a - b).join(", ") || "—"}
          </div>
        )}

        <div className="tableWrap" style={{ marginTop: 12 }}>
          <table>
            <thead>
              <tr>
                <th>Character</th>
                <th>Slot</th>
                <th>Location</th>
                <th>Planet</th>
                <th>Type</th>
                <th>Resource</th>
                <th>Status</th>
                <th className="right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments
                .slice()
                .sort((a, b) => {
                  const c = a.Character.localeCompare(b.Character);
                  if (c !== 0) return c;
                  const sa = typeof a.Slot === "number" ? a.Slot : 999;
                  const sb = typeof b.Slot === "number" ? b.Slot : 999;
                  if (sa !== sb) return sa - sb;
                  return `${a.System}-${a.Planet}`.localeCompare(`${b.System}-${b.Planet}`);
                })
                .map((a) => (
                  <tr key={a.id}>
                    <td style={{ fontWeight: 700 }}>{a.Character}</td>
                    <td>{a.Slot ?? "—"}</td>
                    <td>
                      <span className="sub">
                        {a.Region}
                        {a.Constellation ? ` • ${a.Constellation}` : ""}
                      </span>
                      {a.System}
                    </td>
                    <td>{a.Planet}</td>
                    <td>{s(a.PlanetType) || "—"}</td>
                    <td>
                      <span className="chip">{a.Resource}</span>
                    </td>
                    <td>
                      <button
                        className={`button ${a.Active ? "primary" : ""}`}
                        style={{ padding: "6px 10px", borderRadius: 999 }}
                        onClick={() => onToggle(a.id)}
                      >
                        {a.Active ? "Active" : "Paused"}
                      </button>
                    </td>
                    <td className="right">
                      <button className="button ghost" onClick={() => onDelete(a.id)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              {!filteredAssignments.length && (
                <tr>
                  <td colSpan={8} style={{ padding: 20, textAlign: "center", color: "var(--muted)" }}>
                    No assignments in this view.
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
