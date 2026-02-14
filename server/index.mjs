import { createServer } from "node:http";
import { existsSync, createReadStream, mkdirSync } from "node:fs";
import { extname, join, normalize } from "node:path";
import { DatabaseSync } from "node:sqlite";

const PORT = Number(process.env.PORT || 3000);
const STATIC_DIR = process.env.STATIC_DIR || "dist";
const DB_PATH = process.env.PI_DB_PATH || "/data/pi-tracker.db";
const API_TOKEN = (process.env.PI_API_TOKEN || "").trim();
const BODY_LIMIT_BYTES = Number(process.env.PI_BODY_LIMIT_BYTES || 1_048_576); // 1 MiB default
const JANICE_TIMEOUT_MS = Number(process.env.JANICE_TIMEOUT_MS || 15_000);

mkdirSync("/data", { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    state_json TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );
`);

const defaultState = JSON.stringify({ version: 1, characters: [], assignments: [], scans: [], yields: [] });
const row = db.prepare("SELECT state_json FROM app_state WHERE id = 1").get();
if (!row) {
  db.prepare("INSERT INTO app_state (id, state_json, updated_at) VALUES (1, ?, datetime('now'))").run(defaultState);
}

function writeSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Cross-Origin-Resource-Policy", "same-origin");
}

function sendJson(res, code, body) {
  writeSecurityHeaders(res);
  res.writeHead(code, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(body));
}

async function readBody(req, limitBytes = BODY_LIMIT_BYTES) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    total += buf.length;
    if (total > limitBytes) {
      const err = new Error(`Request body too large (limit ${limitBytes} bytes)`);
      err.name = "PayloadTooLargeError";
      throw err;
    }
    chunks.push(buf);
  }
  return Buffer.concat(chunks).toString("utf8");
}

function getContentType(filePath) {
  const ext = extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "application/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  return "application/octet-stream";
}

function parseJsonOrNull(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function hasValidApiToken(req) {
  if (!API_TOKEN) return true;
  const fromHeader = (req.headers["x-api-token"] || "").toString().trim();
  const fromBearer = (req.headers.authorization || "").toString().replace(/^Bearer\s+/i, "").trim();
  return fromHeader === API_TOKEN || fromBearer === API_TOKEN;
}

async function proxyJanice(req, res, path) {
  const upstream = `https://janice.e-351.com${path.replace(/^\/janice/, "")}`;
  const headers = new Headers();
  const passThroughHeaders = ["x-apikey", "content-type", "accept"];
  for (const key of passThroughHeaders) {
    const v = req.headers[key];
    if (Array.isArray(v)) headers.set(key, v.join(", "));
    else if (typeof v === "string" && v.trim()) headers.set(key, v);
  }

  const method = req.method || "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(req);

  const ac = new AbortController();
  const to = setTimeout(() => ac.abort(), JANICE_TIMEOUT_MS);
  let upstreamRes;
  try {
    upstreamRes = await fetch(upstream, { method, headers, body, signal: ac.signal });
  } finally {
    clearTimeout(to);
  }

  const buf = Buffer.from(await upstreamRes.arrayBuffer());

  // Node fetch may transparently decompress upstream responses. If we forward the
  // original content-encoding/content-length headers unchanged, browsers can fail
  // decoding with ERR_CONTENT_DECODING_FAILED.
  const outHeaders = Object.fromEntries(upstreamRes.headers.entries());
  delete outHeaders["content-encoding"];
  delete outHeaders["content-length"];
  delete outHeaders["transfer-encoding"];
  outHeaders["content-length"] = String(buf.length);

  writeSecurityHeaders(res);
  res.writeHead(upstreamRes.status, outHeaders);
  res.end(buf);
}

const server = createServer(async (req, res) => {
  try {
    const method = req.method || "GET";
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);

    if (url.pathname.startsWith("/janice/")) {
      await proxyJanice(req, res, url.pathname + url.search);
      return;
    }

    if (url.pathname === "/api/health") {
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname.startsWith("/api/") && !hasValidApiToken(req)) {
      sendJson(res, 401, { error: "Unauthorized" });
      return;
    }

    if (url.pathname === "/api/state" && method === "GET") {
      const row = db.prepare("SELECT state_json, updated_at FROM app_state WHERE id = 1").get();
      const state = row ? JSON.parse(row.state_json) : JSON.parse(defaultState);
      sendJson(res, 200, { ...state, _updatedAt: row?.updated_at || null });
      return;
    }

    if (url.pathname === "/api/state" && method === "PUT") {
      const raw = await readBody(req);
      const parsed = parseJsonOrNull(raw || "{}");
      if (!parsed || typeof parsed !== "object") {
        sendJson(res, 400, { error: "Invalid state payload" });
        return;
      }
      db.prepare("INSERT INTO app_state (id, state_json, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json, updated_at=datetime('now')")
        .run(JSON.stringify(parsed));
      sendJson(res, 200, { ok: true });
      return;
    }

    if (url.pathname === "/api/state" && method === "DELETE") {
      db.prepare("INSERT INTO app_state (id, state_json, updated_at) VALUES (1, ?, datetime('now')) ON CONFLICT(id) DO UPDATE SET state_json=excluded.state_json, updated_at=datetime('now')")
        .run(defaultState);
      sendJson(res, 200, { ok: true });
      return;
    }

    const relativePath = url.pathname === "/" ? "/index.html" : url.pathname;
    const normalized = normalize(relativePath).replace(/^\/+/, "");
    let filePath = join(STATIC_DIR, normalized);
    if (!existsSync(filePath)) filePath = join(STATIC_DIR, "index.html");
    if (!existsSync(filePath)) {
      sendJson(res, 404, { error: "Not found" });
      return;
    }

    writeSecurityHeaders(res);
    res.writeHead(200, { "Content-Type": getContentType(filePath) });
    createReadStream(filePath).pipe(res);
  } catch (err) {
    if (err && typeof err === "object" && err.name === "PayloadTooLargeError") {
      sendJson(res, 413, { error: "Payload too large" });
      return;
    }
    sendJson(res, 500, { error: err instanceof Error ? err.message : "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`PI Tracker listening on ${PORT}`);
  console.log(`DB path: ${DB_PATH}`);
  if (API_TOKEN) console.log("API token auth: enabled");
});
