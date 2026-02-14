# PI Tracker (MVP)

Production-ready MVP for tracking EVE Online Planetary Industry colonies, scan heatmaps, yields, and market decisions (Jita vs C-N4OD).

## Proposed structure (implemented)

```text
.
├─ apps/
│  ├─ api/                 # Fastify + Prisma + SQLite API
│  │  ├─ prisma/           # schema + versioned migrations
│  │  └─ src/              # routes, import normalizers, market adapters, tests
│  └─ web/                 # React + TypeScript + Vite + Tailwind UI
├─ packages/
│  └─ shared/              # shared Zod schemas + domain logic
├─ Dockerfile              # single-container deployment (API + static web)
└─ docker-compose.yml      # Unraid-friendly compose example w/ /data volume
```

## Features included

- Characters + assignments with slot safety checks.
- Explorer workflow and “pick from explorer” prefill.
- Heatmap table with score tint + in-use indicator + export region JSON.
- Yield tracking with bulk paste parser.
- Market tab with manual refresh only and decision logic:
  - `hubB lowest sell > hubA highest buy => Sell in Hub B`, otherwise `Make P2`.
- Full export/import JSON with validation and transactional DB replace.
- Heatmap JSON import normalization (`[]` or `{ scans: [] }`).
- Assignment XLSX import with auto character creation and safe slot merge behavior.

## Setup

```bash
npm install
npm run build
npm run dev
```

### API default runtime values

- `PORT=3000`
- `DATABASE_URL=file:/data/pi-tracker.db`

## Docker / Unraid quickstart

### Compose

```bash
docker compose up -d --build
```

Container exposes `3000` and persists SQLite at:

- host: `./data/pi-tracker.db`
- container: `/data/pi-tracker.db`

### Unraid notes

- Map an appdata path to container `/data`.
- Keep `/data/pi-tracker.db` persistent across upgrades.

## Import formats

### Export All JSON

`GET /api/export` returns:

```json
{
  "version": 1,
  "characters": [],
  "assignments": [],
  "scans": [],
  "yields": [],
  "marketSettings": {}
}
```

### Import All JSON

`POST /api/import/replace` with the same shape. Import is validated + all-or-nothing transaction.

### Import Assignments XLSX

`POST /api/import/assignments-xlsx` as base64 workbook of rows:

- `character, slot, region, constellation, system, planet, planetType, resource`

### Import Heatmap JSON

`POST /api/scans/import-heatmap` accepts either:

- `[scan, scan, ...]`
- `{ "scans": [scan, scan, ...] }`

## Market limitations

- ESI adapter in MVP uses public-only style adapter surface (no OAuth).
- Structure visibility may limit market completeness for some regions in real ESI usage.
- Janice adapter is key-based in interface and can be extended to real upstream calls.

## Backups / restore

1. Use `GET /api/export` for logical backup.
2. Copy `/data/pi-tracker.db` for full physical backup.
3. Restore by replacing DB file or posting backup JSON to `/api/import/replace`.

## Testing

Core domain tests live in `apps/api/src/core.test.ts` and cover:

- next-open-slot
- duplicate prevention
- yield parser
- import normalization/migration-path parsing

## Known limitations

- Market providers are scaffolded adapters with deterministic mock pricing in MVP.
- UI is intentionally lean and optimized for simple deployment.
- Import/export controls in UI are minimal and API-first.

## What changed (short changelog)

- Rebuilt project into monorepo (`apps/api`, `apps/web`, `packages/shared`).
- Added Prisma+SQLite backend with migration + transactional import/replace.
- Added React/Tailwind dark UI with required tabs and flows.
- Added shared Zod schemas and tested core logic with Vitest.
- Added single-container Docker deployment with persistent `/data` volume path.
