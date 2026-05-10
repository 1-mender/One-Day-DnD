import fs from "node:fs";
import path from "node:path";
import { performance } from "node:perf_hooks";
import { DATA_DIR } from "../server/src/db.js";
import { uploadsDir } from "../server/src/paths.js";

const argv = process.argv.slice(2);
const argSet = new Set(argv);
const getArg = (name) => {
  const idx = argv.indexOf(name);
  if (idx === -1) return null;
  return argv[idx + 1] || null;
};

const baseUrl = String(process.env.PREFLIGHT_BASE_URL || `http://127.0.0.1:${process.env.PORT || 3000}`)
  .replace(/\/$/, "");
const joinCode = getArg("--join-code") || process.env.PREFLIGHT_JOIN_CODE || "";
const skipWrite = argSet.has("--skip-write");
const timeoutMs = Number(process.env.PREFLIGHT_TIMEOUT_MS || 3000);

function fmtMs(ms) {
  return `${Math.round(ms)}ms`;
}

function fmtBytes(n) {
  if (!Number.isFinite(n)) return "unknown";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let v = n;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i += 1;
  }
  return `${v.toFixed(v < 10 && i > 0 ? 1 : 0)} ${units[i]}`;
}

async function fetchJson(url, options = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  const start = performance.now();
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal });
    const ms = performance.now() - start;
    const data = await res.json().catch(() => ({}));
    return { ok: true, res, data, ms };
  } catch (e) {
    const ms = performance.now() - start;
    return { ok: false, error: e, ms };
  } finally {
    clearTimeout(timer);
  }
}

function checkDisk(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.accessSync(dir, fs.constants.R_OK | fs.constants.W_OK);
    if (typeof fs.statfsSync === "function") {
      const s = fs.statfsSync(dir);
      const free = Number(s.bavail) * Number(s.bsize);
      return { ok: true, free };
    }
    return { ok: true, free: null };
  } catch (e) {
    return { ok: false, error: e };
  }
}

const results = [];
const add = (name, ok, detail) => results.push({ name, ok, detail });

console.log(`Preflight (base: ${baseUrl})`);

const health = await fetchJson(`${baseUrl}/healthz`);
if (health.ok && health.res.status === 200 && health.data?.ok) {
  add("healthz", true, `ok, ${fmtMs(health.ms)}`);
} else {
  add("healthz", false, `failed (${health.res?.status || "no_response"})`);
}

const ready = await fetchJson(`${baseUrl}/readyz`);
if (ready.ok && ready.res.status === 200 && ready.data?.ok) {
  add("readyz", true, `ok, ${fmtMs(ready.ms)}`);
} else {
  add("readyz", false, `failed (${ready.res?.status || "no_response"})`);
}

const info = await fetchJson(`${baseUrl}/api/server/info`);
if (info.ok && info.res.status === 200 && info.data?.party) {
  const urls = Array.isArray(info.data.urls) ? info.data.urls.join(", ") : "n/a";
  add("server info", true, `party=${info.data.party?.name || "n/a"}, urls=${urls}`);
} else {
  add("server info", false, `failed (${info.res?.status || "no_response"})`);
}

const diskTargets = [
  { name: "data dir", dir: DATA_DIR },
  { name: "uploads dir", dir: uploadsDir }
];
const seen = new Set();
for (const d of diskTargets) {
  const real = path.resolve(d.dir);
  if (seen.has(real)) continue;
  seen.add(real);
  const out = checkDisk(real);
  if (out.ok) {
    add(`disk ${d.name}`, true, out.free != null ? `free ${fmtBytes(out.free)}` : "ok");
  } else {
    add(`disk ${d.name}`, false, String(out.error?.message || out.error));
  }
}

if (!skipWrite) {
  const body = { displayName: "__preflight__" };
  if (joinCode) body.joinCode = joinCode;
  const join = await fetchJson(`${baseUrl}/api/party/join-request`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (join.ok && join.res.status === 200 && join.data?.ok) {
    add("write test", true, `joinRequestId=${join.data.joinRequestId}`);
  } else if (join.res?.status === 403 && join.data?.error === "bad_join_code") {
    add("write test", false, "bad join code (pass --join-code or PREFLIGHT_JOIN_CODE)");
  } else if (join.res?.status === 503 && join.data?.error === "read_only") {
    add("write test", false, "read-only mode (server degraded)");
  } else {
    add("write test", false, `failed (${join.res?.status || "no_response"})`);
  }
}

const failed = results.filter((r) => !r.ok);
for (const r of results) {
  console.log(`${r.ok ? "OK " : "FAIL"} ${r.name}: ${r.detail}`);
}

if (!skipWrite) {
  console.log("Note: preflight join-request оставляет запись; отклоните её в DM Lobby.");
}

if (failed.length) {
  console.log(`Preflight failed: ${failed.length} issue(s).`);
  process.exit(1);
} else {
  console.log("Preflight OK.");
}
