// خادم الموقع على Railway: يعرض صفحات الموقع ويحفظ الزيارات والنتائج في PostgreSQL.
const http = require("http");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { Pool } = require("pg");

const PORT = process.env.PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "";
const ALLOWED_ORIGIN = process.env.ALLOWED_ORIGIN || "https://halraheb.github.io";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL === "true" ? { rejectUnauthorized: false } : undefined,
  max: 5
});

const SCHEMA = `
create table if not exists visits (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  visitor_id  text,
  event       text not null,
  name        text,
  mode        text,
  details     jsonb,
  page        text,
  referrer    text,
  user_agent  text,
  lang        text,
  screen      text,
  ip_hash     text
);
create table if not exists attempts (
  id          bigint generated always as identity primary key,
  created_at  timestamptz not null default now(),
  client_id   text unique,
  visitor_id  text,
  name        text not null,
  units       text[] not null default '{}',
  correct     int not null,
  total       int not null,
  pct         int not null,
  by_topic    jsonb
);
create index if not exists visits_created_idx   on visits (created_at desc);
create index if not exists attempts_created_idx on attempts (created_at desc);
`;

const STATIC = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/admin.html": ["admin.html", "text/html; charset=utf-8"],
  "/admin": ["admin.html", "text/html; charset=utf-8"],
  "/config.js": ["config.js", "application/javascript; charset=utf-8"],
  "/db.js": ["db.js", "application/javascript; charset=utf-8"]
};

// ---- helpers ----
const str = (v, n) => (v == null || v === "" ? null : String(v).slice(0, n));
const int = (v, lo, hi) => { const x = Math.round(Number(v)); return Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : lo; };
const smallJson = (v, n) => { try { const s = JSON.stringify(v ?? null); return s.length <= n ? s : null; } catch (e) { return null; } };
const ipOf = req => String(req.headers["x-forwarded-for"] || req.socket.remoteAddress || "").split(",")[0].trim();
const ipHash = ip => crypto.createHash("sha256").update(ip + (process.env.IP_SALT || "khuwaildiya")).digest("hex").slice(0, 16);

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", ...headers });
  res.end(typeof body === "string" ? body : JSON.stringify(body));
}
function cors(req) {
  const o = req.headers.origin;
  return o && o === ALLOWED_ORIGIN
    ? { "Access-Control-Allow-Origin": o, "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", Vary: "Origin" }
    : {};
}
function readBody(req, limit = 8000) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", c => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => { try { resolve(JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}")); } catch (e) { reject(e); } });
    req.on("error", reject);
  });
}
// حد بسيط لعدد الطلبات من نفس الجهاز: 60 طلبًا في الدقيقة
const hits = new Map();
function limited(ip) {
  const now = Date.now(), h = hits.get(ip) || { n: 0, t: now };
  if (now - h.t > 60000) { h.n = 0; h.t = now; }
  h.n++; hits.set(ip, h);
  if (hits.size > 10000) hits.clear();
  return h.n > 60;
}
function isAdmin(req) {
  if (!ADMIN_PASSWORD) return false;
  const got = Buffer.from(String(req.headers.authorization || "").replace(/^Bearer\s+/i, ""));
  const want = Buffer.from(ADMIN_PASSWORD);
  return got.length === want.length && crypto.timingSafeEqual(got, want);
}

const EVENTS = new Set(["visit", "start", "team_finish"]);

async function handleApi(req, res, url) {
  const h = cors(req);
  if (req.method === "OPTIONS") return send(res, 204, "", h);
  const ip = ipOf(req);

  if (req.method === "POST" && (url.pathname === "/api/visits" || url.pathname === "/api/attempts")) {
    if (limited(ip)) return send(res, 429, { error: "rate limited" }, h);
    let b; try { b = await readBody(req); } catch (e) { return send(res, 400, { error: "bad body" }, h); }
    if (url.pathname === "/api/visits") {
      if (!EVENTS.has(b.event)) return send(res, 400, { error: "bad event" }, h);
      await pool.query(
        `insert into visits (visitor_id,event,name,mode,details,page,referrer,user_agent,lang,screen,ip_hash)
         values ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9,$10,$11)`,
        [str(b.visitor_id, 60), b.event, str(b.name, 60), str(b.mode, 20), smallJson(b.details, 4000),
         str(b.page, 200), str(b.referrer, 300), str(b.user_agent, 300), str(b.lang, 20), str(b.screen, 20), ipHash(ip)]);
    } else {
      const total = int(b.total, 0, 200), correct = Math.min(int(b.correct, 0, 200), total);
      const units = Array.isArray(b.units) ? b.units.slice(0, 10).map(u => String(u).slice(0, 10)) : [];
      await pool.query(
        `insert into attempts (client_id,visitor_id,name,units,correct,total,pct,by_topic)
         values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb) on conflict (client_id) do nothing`,
        [str(b.client_id, 60), str(b.visitor_id, 60), str(b.name, 60) || "طالب", units, correct, total,
         int(b.pct, 0, 100), smallJson(b.by_topic, 2000)]);
    }
    return send(res, 201, { ok: true }, h);
  }

  if (req.method === "GET" && url.pathname === "/api/admin/data") {
    if (!isAdmin(req)) { await new Promise(r => setTimeout(r, 500)); return send(res, 401, { error: "unauthorized" }, h); }
    const [a, v] = await Promise.all([
      pool.query("select * from attempts order by created_at desc limit 20000"),
      pool.query("select id,created_at,visitor_id,event,name,mode,details,page,referrer,user_agent,lang,screen from visits order by created_at desc limit 20000")
    ]);
    return send(res, 200, { attempts: a.rows, visits: v.rows }, h);
  }

  if (req.method === "GET" && url.pathname === "/api/health") return send(res, 200, { ok: true }, h);
  return send(res, 404, { error: "not found" }, h);
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, "http://x");
  try {
    if (url.pathname.startsWith("/api/")) return await handleApi(req, res, url);
    const f = STATIC[url.pathname];
    if (req.method !== "GET" || !f) return send(res, 404, "Not found", { "Content-Type": "text/plain; charset=utf-8" });
    fs.readFile(path.join(__dirname, f[0]), (err, data) => {
      if (err) return send(res, 500, "Error", { "Content-Type": "text/plain" });
      res.writeHead(200, { "Content-Type": f[1], "Cache-Control": "no-cache" });
      res.end(data);
    });
  } catch (e) {
    console.error(e);
    send(res, 500, { error: "server error" }, cors(req));
  }
});

(async () => {
  if (!process.env.DATABASE_URL) console.warn("DATABASE_URL is not set: add a PostgreSQL database in Railway.");
  else await pool.query(SCHEMA);
  if (!ADMIN_PASSWORD) console.warn("ADMIN_PASSWORD is not set: the teacher dashboard is locked.");
  server.listen(PORT, () => console.log(`Listening on ${PORT}`));
})().catch(e => { console.error(e); process.exit(1); });
