import Fastify from 'fastify';
import cors from '@fastify/cors';
import path from 'node:path';
import fs from 'node:fs';
import fastifyStatic from '@fastify/static';
import {
  assignmentSchema,
  characterSchema,
  getNextOpenSlot,
  hasDuplicatePlanetForCharacter,
  marketSettingsSchema,
  parseYieldPaste,
  scanSchema,
  yieldSchema,
} from '@pi-tracker/shared';
import { ensureMarketSettings, prisma } from './db.js';
import { decisionForQuote, EsiAdapter, JaniceAdapter } from './market.js';
import { normalizeHeatmapPayload, normalizeImportPayload, parseAssignmentsXlsx } from './imports.js';

const app = Fastify({ logger: true });
await app.register(cors, { origin: true });

const webDist = path.resolve(process.cwd(), 'apps/web/dist');
if (fs.existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist });
}

const errorShape = (message: string, details?: string[]) => ({ error: { message, details: details ?? [] } });

app.get('/api/health', async () => ({ ok: true }));

app.get('/api/characters', async () => prisma.character.findMany({ orderBy: { name: 'asc' } }));
app.post('/api/characters', async (req, reply) => {
  const parsed = characterSchema.omit({ id: true }).safeParse(req.body);
  if (!parsed.success) return reply.status(400).send(errorShape('Invalid character payload', parsed.error.issues.map((i) => i.message)));
  return prisma.character.create({ data: { ...parsed.data, id: crypto.randomUUID() } });
});
app.put('/api/characters/:id', async (req, reply) => {
  const parsed = characterSchema.omit({ id: true }).partial().safeParse(req.body);
  if (!parsed.success) return reply.status(400).send(errorShape('Invalid character payload'));
  return prisma.character.update({ where: { id: (req.params as { id: string }).id }, data: parsed.data });
});

app.get('/api/assignments', async () => prisma.assignment.findMany());
app.post('/api/assignments', async (req, reply) => {
  const parsed = assignmentSchema.omit({ id: true }).safeParse(req.body);
  if (!parsed.success) return reply.status(400).send(errorShape('Invalid assignment payload', parsed.error.issues.map((i) => i.message)));
  const existing = await prisma.assignment.findMany({ where: { characterId: parsed.data.characterId } });
  if (hasDuplicatePlanetForCharacter(existing, parsed.data.characterId, parsed.data.system, parsed.data.planet)) {
    return reply.status(400).send(errorShape('Duplicate planet assignment for this character'));
  }
  if (existing.some((a) => a.active && a.slot === parsed.data.slot)) {
    return reply.status(400).send(errorShape('Slot already occupied'));
  }
  return prisma.assignment.create({ data: { ...parsed.data, id: crypto.randomUUID() } });
});
app.put('/api/assignments/:id', async (req) => prisma.assignment.update({ where: { id: (req.params as { id: string }).id }, data: req.body as object }));
app.delete('/api/assignments/:id', async (req) => prisma.assignment.delete({ where: { id: (req.params as { id: string }).id } }));

app.get('/api/scans', async () => prisma.scan.findMany());
app.post('/api/scans/import-heatmap', async (req, reply) => {
  const parsed = normalizeHeatmapPayload(req.body);
  if (!parsed.ok) return reply.status(400).send(errorShape('Invalid heatmap payload', parsed.errors));
  await prisma.$transaction([prisma.scan.deleteMany({}), prisma.scan.createMany({ data: parsed.data })]);
  return { imported: parsed.data.length };
});

app.get('/api/yields', async () => prisma.yield.findMany({ orderBy: { date: 'desc' } }));
app.post('/api/yields', async (req, reply) => {
  const parsed = yieldSchema.omit({ id: true }).safeParse(req.body);
  if (!parsed.success) return reply.status(400).send(errorShape('Invalid yield payload'));
  return prisma.yield.create({ data: { ...parsed.data, id: crypto.randomUUID() } });
});
app.post('/api/yields/parse', async (req) => parseYieldPaste((req.body as { text: string }).text ?? ''));
app.delete('/api/yields/:id', async (req) => prisma.yield.delete({ where: { id: (req.params as { id: string }).id } }));

app.get('/api/market-settings', async () => {
  await ensureMarketSettings();
  return prisma.marketSettings.findUnique({ where: { id: 1 } });
});
app.put('/api/market-settings', async (req, reply) => {
  const parsed = marketSettingsSchema.safeParse(req.body);
  if (!parsed.success) return reply.status(400).send(errorShape('Invalid market settings payload'));
  return prisma.marketSettings.upsert({ where: { id: 1 }, create: { id: 1, ...parsed.data }, update: parsed.data });
});

app.post('/api/market/refresh', async (req) => {
  const { products } = req.body as { products: string[] };
  const settings = await prisma.marketSettings.findUnique({ where: { id: 1 } });
  const adapter = settings?.source === 'janice' ? new JaniceAdapter(settings.janiceApiKey ?? undefined) : new EsiAdapter();
  const quotes = await adapter.fetchQuotes(products ?? []);
  return quotes.map((q) => ({ ...q, decision: decisionForQuote(q) }));
});

app.get('/api/export', async () => {
  await ensureMarketSettings();
  const [characters, assignments, scans, yields, marketSettings] = await Promise.all([
    prisma.character.findMany(),
    prisma.assignment.findMany(),
    prisma.scan.findMany(),
    prisma.yield.findMany(),
    prisma.marketSettings.findUnique({ where: { id: 1 } }),
  ]);
  return { version: 1, characters, assignments, scans, yields, marketSettings };
});

app.post('/api/import/replace', async (req, reply) => {
  const parsed = normalizeImportPayload(req.body);
  if (!parsed.success) return reply.status(400).send(errorShape('Import validation failed', parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`)));
  await prisma.$transaction(async (tx) => {
    await tx.assignment.deleteMany({});
    await tx.character.deleteMany({});
    await tx.scan.deleteMany({});
    await tx.yield.deleteMany({});
    await tx.marketSettings.deleteMany({});
    await tx.character.createMany({ data: parsed.data.characters });
    await tx.assignment.createMany({ data: parsed.data.assignments });
    await tx.scan.createMany({ data: parsed.data.scans });
    await tx.yield.createMany({ data: parsed.data.yields });
    await tx.marketSettings.create({ data: { id: 1, ...parsed.data.marketSettings } });
  });
  return { ok: true };
});

app.post('/api/import/assignments-xlsx', async (req, reply) => {
  const body = req.body as { base64: string };
  const result = parseAssignmentsXlsx(Buffer.from(body.base64, 'base64'));
  if (!result.success) return reply.status(400).send(errorShape('Invalid XLSX rows', result.error.issues.map((i) => i.message)));

  const rows = result.data;
  await prisma.$transaction(async (tx) => {
    for (const row of rows) {
      const existing = await tx.character.findFirst({ where: { name: row.character } });
      const rowSlot = row.slot ?? 1;
      const existingAssignments = existing ? await tx.assignment.findMany({ where: { characterId: existing.id } }) : [];
      const inferredSlots = Math.max(rowSlot, existing?.slotsTotal ?? existingAssignments.length + 1);
      const character = existing
        ? await tx.character.update({ where: { id: existing.id }, data: { slotsTotal: Math.max(existing.slotsTotal, inferredSlots) } })
        : await tx.character.create({ data: { id: crypto.randomUUID(), name: row.character, slotsTotal: inferredSlots, active: true } });
      const openSlot = getNextOpenSlot(character.slotsTotal, existingAssignments) ?? rowSlot;
      if (!hasDuplicatePlanetForCharacter(existingAssignments, character.id, row.system, row.planet)) {
        await tx.assignment.create({
          data: {
            id: crypto.randomUUID(),
            characterId: character.id,
            slot: row.slot ?? openSlot,
            region: row.region,
            constellation: row.constellation,
            system: row.system,
            planet: row.planet,
            planetType: row.planetType,
            resource: row.resource,
            active: true,
          },
        });
      }
    }
  });
  return { imported: rows.length };
});

app.setNotFoundHandler(async (_req, reply) => {
  if (fs.existsSync(webDist)) return reply.sendFile('index.html');
  return reply.status(404).send({ error: 'Not found' });
});

const port = Number(process.env.PORT ?? 3000);
await ensureMarketSettings();
app.listen({ host: '0.0.0.0', port });
