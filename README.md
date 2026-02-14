# PI Tracker

PI Tracker is a Vite + React app for:
- character → planet assignments (XLSX import)
- scan heatmaps (JSON import)
- yield logs over time

## Storage modes

- **Dev (default):** local browser storage with optional API hydration.
- **Docker/Server:** persistent SQLite database (`/data/pi-tracker.db`) via built-in API, so data is not tied to browser cache.

## Local development

```bash
npm install
npm run dev
```

The dev server runs on `http://localhost:5173`.

## Production build

```bash
npm run build
npm run preview
```

## Run with Node (no Docker)

```bash
npm run build
npm run start
```

Server defaults:
- App URL: `http://localhost:3000`
- API: `/api/state`
- DB file: `/data/pi-tracker.db` (set `PI_DB_PATH` to change)
- Optional API auth token: set `PI_API_TOKEN` on server and `VITE_API_TOKEN` in frontend build

---

## Unraid + Docker deployment (step by step)

## Quick answer: do I need a separate database first?

**No.** You do **not** run Postgres/MySQL/SQLite separately.

The container includes everything and creates/uses a local SQLite file automatically.
You only need to map a persistent host folder to `/data`.

- Inside container: `PI_DB_PATH=/data/pi-tracker.db`
- On Unraid host (example): `/mnt/user/appdata/pi-tracker/pi-tracker.db`

So this mapping:

- Host path: `/mnt/user/appdata/pi-tracker`
- Container path: `/data`

means the DB file will appear on the host at:

`/mnt/user/appdata/pi-tracker/pi-tracker.db`

---

Below are two good ways to deploy on Unraid. **Option A (Compose Manager)** is usually easiest.

### Prerequisites

1. Unraid server is running and reachable.
2. You have a persistent appdata path (example):
   - `/mnt/user/appdata/pi-tracker`
3. Docker is enabled in Unraid (`Settings` → `Docker`).

Create the appdata folder if needed:

```bash
mkdir -p /mnt/user/appdata/pi-tracker
```

---

### Option A: Unraid Compose Manager (recommended)

1. In Unraid Web UI, open **Docker** → **Compose** (or **Compose Manager** plugin).
2. Create a new stack named `pi-tracker`.
3. Use this compose file:

```yaml
services:
  pi-tracker:
    build: /mnt/user/path/to/this/repo
    container_name: pi-tracker
    ports:
      - "3000:3000"
    environment:
      - PORT=3000
      - PI_DB_PATH=/data/pi-tracker.db  # inside container path
      # Optional: protect /api/* with token auth
      # - PI_API_TOKEN=change-me
    volumes:
      - /mnt/user/appdata/pi-tracker:/data
    restart: unless-stopped
```

4. Deploy the stack.
5. Wait for the build/start to finish.
6. Open: `http://<UNRAID-IP>:3000`
7. Confirm health endpoint works:

```bash
curl http://<UNRAID-IP>:3000/api/health
```

Expected response:

```json
{"ok":true}
```

8. Your database will persist at:
   - `/mnt/user/appdata/pi-tracker/pi-tracker.db`

#### Updating later (Compose)

- Pull latest repo changes on Unraid.
- Re-deploy/rebuild the stack.
- Your `/data` volume keeps state.

---

### Option B: Unraid Docker template (manual image/container workflow)

If you prefer normal Unraid Docker templates:

1. Build and push an image from another machine (or CI), e.g.:
   - `yourrepo/pi-tracker:latest`
2. In Unraid, go to **Docker** → **Add Container**.
3. Configure:
   - **Name:** `pi-tracker`
   - **Repository:** `yourrepo/pi-tracker:latest`
   - **Network Type:** `bridge`
4. Add **Port Mapping**:
   - Container `3000` → Host `3000` (or another host port)
5. Add **Path Mapping**:
   - Host Path: `/mnt/user/appdata/pi-tracker`
   - Container Path: `/data`
6. Add **Environment Variables**:
   - `PORT=3000`
   - `PI_DB_PATH=/data/pi-tracker.db`  ← this is the **container** path, not host path
7. Apply and start container.
8. Open: `http://<UNRAID-IP>:3000`

---

### Option C: Plain docker run (CLI)

If you SSH into Unraid and want direct Docker commands:

```bash
docker build -t pi-tracker:latest /mnt/user/path/to/this/repo

docker run -d \
  --name pi-tracker \
  -p 3000:3000 \
  -e PORT=3000 \
  -e PI_DB_PATH=/data/pi-tracker.db \
  # Optional: -e PI_API_TOKEN=change-me \
  -v /mnt/user/appdata/pi-tracker:/data \
  --restart unless-stopped \
  pi-tracker:latest
```

---

## Backups and migration

- App state is persisted in SQLite at `/data/pi-tracker.db`.
- Back up the whole `/mnt/user/appdata/pi-tracker` folder.
- UI import/export JSON still works for manual backups and transfer.

## API endpoints

- `GET /api/health` → `{ ok: true }`
- `GET /api/state` → current tracker state
- `PUT /api/state` → save full tracker state JSON
- `DELETE /api/state` → reset to empty state


## Security notes and dependency posture

- `xlsx` currently has published advisories with no upstream fix available at this time.
- Mitigations in this repo:
  - XLSX import size and row limits
  - Heatmap JSON size and row limits
  - API request body size limit on the Node server
  - Optional token auth for `/api/*` via `PI_API_TOKEN`
- Operational recommendation: only import trusted XLSX files; use JSON export backups regularly.

For private/LAN-only use this is typically acceptable, but keep dependencies updated and re-run:

```bash
npm audit
npm audit --omit=dev
```

## Notes

- `/janice/*` is proxied through the same server in production.
- If you already used browser-local data, export JSON from the old instance and import it into the new Docker deployment once.
