import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";

const READY_TIMEOUT_MS = Number(process.env.E2E_READY_TIMEOUT_MS || 15000);
const READY_SAMPLES = Number(process.env.E2E_READY_SAMPLES || 20);
const READY_P95_MS = Number(process.env.E2E_READY_P95_MS || 300);
const REQUEST_TIMEOUT_MS = Number(process.env.E2E_REQUEST_TIMEOUT_MS || 5000);

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.unref();
    server.on("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolve(port));
    });
  });
}

async function fetchJson(url, { method = "GET", body, headers = {} } = {}) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method,
      headers: {
        "content-type": "application/json",
        ...headers
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal
    });
    const text = await res.text();
    let json = null;
    try {
      json = text ? JSON.parse(text) : null;
    } catch {
      json = null;
    }
    return { res, json, text };
  } finally {
    clearTimeout(timer);
  }
}

async function waitForReady(baseUrl) {
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT_MS) {
    try {
      const { res } = await fetchJson(`${baseUrl}/readyz`);
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await sleep(200);
  }
  return false;
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function measureReady(baseUrl) {
  const samples = [];
  for (let i = 0; i < READY_SAMPLES; i += 1) {
    const t0 = Date.now();
    const { res } = await fetchJson(`${baseUrl}/readyz`);
    const dt = Date.now() - t0;
    if (!res.ok) {
      throw new Error(`readyz failed with status ${res.status}`);
    }
    samples.push(dt);
  }
  const p95 = percentile(samples, 95);
  return { samples, p95 };
}

function extractCookie(res) {
  const header = res.headers.get("set-cookie") || "";
  if (!header) return "";
  return header.split(";")[0];
}

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-e2e-"));
  const port = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "test",
    LOG_LEVEL: process.env.LOG_LEVEL || "warn",
    DND_LAN_DATA_DIR: dataDir,
    READINESS_CHECK_EVERY_MS: "2000",
    CLEANUP_EVERY_MS: "0",
    TRANSFER_CLEANUP_EVERY_MS: "0"
  };

  const server = spawn("node", ["server/src/index.js"], {
    env,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  server.stdout.on("data", (d) => { stdout += d.toString(); });
  server.stderr.on("data", (d) => { stderr += d.toString(); });

  const shutdown = async () => {
    if (!server.killed) {
      server.kill("SIGTERM");
      await new Promise((resolve) => {
        const timer = setTimeout(resolve, 3000);
        server.on("exit", () => {
          clearTimeout(timer);
          resolve();
        });
      });
    }
  };

  try {
    const ready = await waitForReady(baseUrl);
    if (!ready) {
      throw new Error(`server not ready within ${READY_TIMEOUT_MS}ms`);
    }

    const { p95 } = await measureReady(baseUrl);
    if (p95 != null && p95 > READY_P95_MS) {
      throw new Error(`readyz p95 ${p95}ms exceeds ${READY_P95_MS}ms`);
    }

    const dmUsername = "dm";
    const dmPassword = "secret123";
    const setup = await fetchJson(`${baseUrl}/api/dm/setup`, {
      method: "POST",
      body: { username: dmUsername, password: dmPassword }
    });
    if (!setup.res.ok) {
      throw new Error(`dm setup failed: ${setup.res.status} ${setup.text}`);
    }

    const login = await fetchJson(`${baseUrl}/api/auth/login`, {
      method: "POST",
      body: { username: dmUsername, password: dmPassword }
    });
    if (!login.res.ok) {
      throw new Error(`dm login failed: ${login.res.status} ${login.text}`);
    }
    const dmCookie = extractCookie(login.res);
    if (!dmCookie) {
      throw new Error("dm login did not return cookie");
    }

    const join = await fetchJson(`${baseUrl}/api/party/join-request`, {
      method: "POST",
      body: { displayName: "Player One", joinCode: "" }
    });
    if (!join.res.ok || !join.json?.joinRequestId) {
      throw new Error(`join request failed: ${join.res.status} ${join.text}`);
    }

    const approve = await fetchJson(`${baseUrl}/api/party/approve`, {
      method: "POST",
      body: { joinRequestId: join.json.joinRequestId },
      headers: { cookie: dmCookie }
    });
    if (!approve.res.ok || !approve.json?.playerToken) {
      throw new Error(`approve failed: ${approve.res.status} ${approve.text}`);
    }
    const playerToken = approve.json.playerToken;

    const me = await fetchJson(`${baseUrl}/api/players/me`, {
      headers: { "x-player-token": playerToken }
    });
    if (!me.res.ok || !me.json?.player?.id) {
      throw new Error(`player/me failed: ${me.res.status} ${me.text}`);
    }

    const createItem = await fetchJson(`${baseUrl}/api/inventory/mine`, {
      method: "POST",
      headers: { "x-player-token": playerToken },
      body: { name: "Torch", qty: 1, weight: 1 }
    });
    if (!createItem.res.ok || !createItem.json?.id) {
      throw new Error(`inventory create failed: ${createItem.res.status} ${createItem.text}`);
    }

    const inv = await fetchJson(`${baseUrl}/api/inventory/mine`, {
      headers: { "x-player-token": playerToken }
    });
    if (!inv.res.ok || !Array.isArray(inv.json?.items) || inv.json.items.length === 0) {
      throw new Error(`inventory read failed: ${inv.res.status} ${inv.text}`);
    }

    console.log("E2E OK");
    console.log(`readyz p95: ${p95}ms (threshold ${READY_P95_MS}ms)`);
  } catch (err) {
    console.error("E2E FAILED:", err?.message || err);
    if (stdout.trim()) console.error("server stdout:", stdout.trim());
    if (stderr.trim()) console.error("server stderr:", stderr.trim());
    await shutdown();
    process.exit(1);
  }

  await shutdown();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
