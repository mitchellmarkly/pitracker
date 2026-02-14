import * as XLSX from 'xlsx';
import { z } from 'zod';
import { importPayloadSchema, normalizeHeatmapPayload } from '@pi-tracker/shared';

const assignmentXlsxRow = z.object({
  character: z.string().min(1),
  slot: z.coerce.number().int().min(1).optional(),
  region: z.string(),
  constellation: z.string(),
  system: z.string(),
  planet: z.string(),
  planetType: z.string(),
  resource: z.string(),
});

export const parseAssignmentsXlsx = (buffer: Buffer) => {
  const wb = XLSX.read(buffer, { type: 'buffer' });
  const sheet = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
  const normalized = json.map((r) => ({
    character: String(r.character ?? r.Character ?? '').trim(),
    slot: r.slot ?? r.Slot,
    region: String(r.region ?? r.Region ?? '').trim(),
    constellation: String(r.constellation ?? r.Constellation ?? '').trim(),
    system: String(r.system ?? r.System ?? '').trim(),
    planet: String(r.planet ?? r.Planet ?? '').trim(),
    planetType: String(r.planetType ?? r.PlanetType ?? r['Planet Type'] ?? '').trim(),
    resource: String(r.resource ?? r.Resource ?? '').trim(),
  }));
  return z.array(assignmentXlsxRow).safeParse(normalized);
};

export const normalizeImportPayload = (payload: unknown) => importPayloadSchema.safeParse(payload);
export { normalizeHeatmapPayload };
