# PI Tracker (local-first)

This is a small Vite + React app to track:
- character → planet assignments (import from XLSX)
- scan heatmaps (import from JSON)
- yield logs over time (paste totals)

All data is stored in your browser (localStorage). Export JSON for backups.

## Quick start

1. Install Node.js 18+ (or 20+).
2. In this folder:

```bash
npm install
npm run dev
```

Open the URL Vite prints (usually http://localhost:5173).

## Import

- **Assignments (XLSX)**: expects a sheet named `Assignments` (or `Used`) with columns:
  `Character, Slot, Region, Constellation, System, Planet, Planet Type, Resource, Active, Notes`

- **Heatmap (JSON)**: expects a JSON file with shape:
```json
{
  "schemaVersion": 1,
  "kind": "pi-heatmap",
  "region": "Delve",
  "scans": [
    { "Region":"Delve","Constellation":"...","System":"...","Planet":"P1","PlanetType":"...","Resource":"...","Value":0.62 }
  ]
}
```

A sample `public/heatmap-delve.json` is included.

## Build

```bash
npm run build
npm run preview
```

## Simple Unraid / Docker (static hosting)

Build locally first (`npm run build`), then serve `dist/`:

This repo includes an `nginx.conf` that also proxies `/janice/*` for Janice API calls.

```yaml
services:
  pi-tracker:
    image: nginx:alpine
    ports:
      - "8080:80"
    volumes:
      - /mnt/user/appdata/pi-tracker/dist:/usr/share/nginx/html:ro
      - /mnt/user/appdata/pi-tracker/nginx.conf:/etc/nginx/conf.d/default.conf:ro
    restart: unless-stopped
```

