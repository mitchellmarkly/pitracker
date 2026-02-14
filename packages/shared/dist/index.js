import { z } from 'zod';
export const characterSchema = z.object({
    id: z.string(),
    name: z.string().min(1),
    slotsTotal: z.number().int().min(1),
    active: z.boolean().default(true),
});
export const assignmentSchema = z.object({
    id: z.string(),
    characterId: z.string(),
    slot: z.number().int().min(1),
    region: z.string().min(1),
    constellation: z.string().min(1),
    system: z.string().min(1),
    planet: z.string().min(1),
    planetType: z.string().min(1),
    resource: z.string().min(1),
    active: z.boolean().default(true),
    notes: z.string().optional(),
});
export const scanSchema = z.object({
    id: z.string(),
    region: z.string().min(1),
    constellation: z.string().min(1),
    system: z.string().min(1),
    planet: z.string().min(1),
    planetType: z.string().min(1),
    resource: z.string().min(1),
    value: z.number(),
});
export const yieldSchema = z.object({
    id: z.string(),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    product: z.string().min(1),
    amount: z.number(),
    notes: z.string().optional(),
});
export const marketSettingsSchema = z.object({
    source: z.enum(['esi', 'janice']).default('esi'),
    hubAName: z.string().default('Jita'),
    hubBName: z.string().default('C-N4OD'),
    productLimit: z.number().int().min(1).max(1000).default(50),
    maxPages: z.number().int().min(1).max(20).default(3),
    janiceApiKey: z.string().optional(),
    rememberKey: z.boolean().optional(),
});
export const importPayloadSchema = z.object({
    version: z.number().int().default(1),
    characters: z.array(characterSchema),
    assignments: z.array(assignmentSchema),
    scans: z.array(scanSchema),
    yields: z.array(yieldSchema),
    marketSettings: marketSettingsSchema,
});
export const normalizeHeatmapPayload = (payload) => {
    const rows = Array.isArray(payload)
        ? payload
        : typeof payload === 'object' && payload !== null && 'scans' in payload
            ? payload.scans
            : payload;
    const parsed = z.array(scanSchema).safeParse(rows);
    if (!parsed.success) {
        return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`) };
    }
    return { ok: true, data: parsed.data };
};
export const getNextOpenSlot = (slotsTotal, assignments) => {
    const used = new Set(assignments.filter((a) => a.active).map((a) => a.slot));
    for (let i = 1; i <= slotsTotal; i += 1) {
        if (!used.has(i))
            return i;
    }
    return null;
};
export const hasDuplicatePlanetForCharacter = (assignments, characterId, system, planet) => assignments.some((a) => a.active && a.characterId === characterId && a.system === system && a.planet === planet);
const ymdToday = () => new Date().toISOString().slice(0, 10);
export const parseYieldPaste = (input) => {
    const lines = input.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const parsed = [];
    const errors = [];
    lines.forEach((line, idx) => {
        const parts = line.split(/[\t, ]+/).filter(Boolean);
        let date = ymdToday();
        let product = '';
        let amountToken = '';
        if (parts.length >= 3 && /^\d{4}-\d{2}-\d{2}$/.test(parts[0])) {
            date = parts[0];
            product = parts.slice(1, parts.length - 1).join(' ');
            amountToken = parts[parts.length - 1];
        }
        else if (parts.length >= 2) {
            product = parts.slice(0, parts.length - 1).join(' ');
            amountToken = parts[parts.length - 1];
        }
        else {
            errors.push(`Line ${idx + 1}: expected at least product and amount`);
            return;
        }
        const amount = Number(amountToken);
        if (!Number.isFinite(amount)) {
            errors.push(`Line ${idx + 1}: amount is invalid`);
            return;
        }
        parsed.push({ date, product, amount });
    });
    return { parsed, errors };
};
