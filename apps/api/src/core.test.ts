import { describe, expect, it } from 'vitest';
import { getNextOpenSlot, hasDuplicatePlanetForCharacter, parseYieldPaste, normalizeHeatmapPayload } from '@pi-tracker/shared';
import { normalizeImportPayload } from './imports.js';

describe('slot selection', () => {
  it('selects next open active slot', () => {
    const slot = getNextOpenSlot(4, [
      { slot: 1, active: true },
      { slot: 2, active: false },
      { slot: 3, active: true },
    ]);
    expect(slot).toBe(2);
  });
});

describe('duplicate prevention', () => {
  it('blocks duplicate planet/system per character', () => {
    expect(
      hasDuplicatePlanetForCharacter(
        [{ characterId: 'c1', system: 'A', planet: 'I', active: true }],
        'c1',
        'A',
        'I',
      ),
    ).toBe(true);
  });
});

describe('yield parser', () => {
  it('parses mixed delimiters', () => {
    const out = parseYieldPaste('2024-01-01, Coolant, 12.5\nMechanical Parts\t9.25');
    expect(out.errors).toHaveLength(0);
    expect(out.parsed).toHaveLength(2);
    expect(out.parsed[0].amount).toBe(12.5);
  });
});

describe('import normalization', () => {
  it('accepts versioned full payload and heatmap variants', () => {
    const payload = {
      version: 1,
      characters: [{ id: '1', name: 'A', slotsTotal: 4, active: true }],
      assignments: [],
      scans: [],
      yields: [],
      marketSettings: { source: 'esi', hubAName: 'Jita', hubBName: 'C-N4OD', productLimit: 50, maxPages: 3 },
    };
    expect(normalizeImportPayload(payload).success).toBe(true);
    expect(normalizeHeatmapPayload({ scans: [] }).ok).toBe(true);
  });
});
