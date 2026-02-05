import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { io as clientIo } from "socket.io-client";

const READY_TIMEOUT_MS = Number(process.env.CHAOS_READY_TIMEOUT_MS || 15000);
const REQUEST_TIMEOUT_MS = Number(process.env.CHAOS_REQUEST_TIMEOUT_MS || 5000);
const RECONNECT_LOOPS = Number(process.env.CHAOS_RECONNECT_LOOPS || 50);
const RECONNECT_P95_MS = Number(process.env.CHAOS_RECONNECT_P95_MS || 5000);
const PRESENCE_GRACE_MS = Number(process.env.CHAOS_GRACE_MS || 1000);

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

function extractCookie(res) {
  const header = res.headers.get("set-cookie") || "";
  if (!header) return "";
  return header.split(";")[0];
}

async function getPlayers(baseUrl, dmCookie) {
  const { res, json, text } = await fetchJson(`${baseUrl}/api/players`, {
    headers: { cookie: dmCookie }
  });
  if (!res.ok) throw new Error(`players list failed: ${res.status} ${text}`);
  return json?.items || [];
}

async function getPlayerStatus(baseUrl, dmCookie, playerId) {
  const items = await getPlayers(baseUrl, dmCookie);
  const p = items.find((i) => Number(i.id) === Number(playerId));
  return p?.status || "unknown";
}

async function waitForStatus(baseUrl, dmCookie, playerId, status, timeoutMs) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const s = await getPlayerStatus(baseUrl, dmCookie, playerId);
    if (s === status) return true;
    await sleep(100);
  }
  return false;
}

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-chaos-"));
  const port = process.env.CHAOS_PORT ? Number(process.env.CHAOS_PORT) : await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const env = {
    ...process.env,
    PORT: String(port),
    NODE_ENV: "test",
    LOG_LEVEL: process.env.LOG_LEVEL || "warn",
    DND_LAN_DATA_DIR: dataDir,
    READINESS_CHECK_EVERY_MS: "2000",
    CLEANUP_EVERY_MS: "0",
    TRANSFER_CLEANUP_EVERY_MS: "0",
    PRESENCE_GRACE_MS: String(PRESENCE_GRACE_MS)
  };

  const server = spawn("node", ["src/index.js"], {
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
    if (!ready) throw new Error(`server not ready within ${READY_TIMEOUT_MS}ms`);

    const dmUsername = "dm";
    const dmPassword = "secret123";
    const setup = await fetchJson(`${baseUrl}/api/dm/setup`, {
      method: "POST",
      body: { username: dmUsername, password: dmPassword }
    });
    if (!setup.res.ok) throw new Error(`dm setup failed: ${setup.res.status} ${setup.text}`);

    const login = await fetchJson(`${baseUrl}/api/auth/login`, {
      method: "POST",
      body: { username: dmUsername, password: dmPassword }
    });
    if (!login.res.ok) throw new Error(`dm login failed: ${login.res.status} ${login.text}`);
    const dmCookie = extractCookie(login.res);
    if (!dmCookie) throw new Error("dm login did not return cookie");

    async function createPlayer(displayName) {
      const join = await fetchJson(`${baseUrl}/api/party/join-request`, {
        method: "POST",
        body: { displayName, joinCode: "" }
      });
      if (!join.res.ok || !join.json?.joinRequestId) {
        throw new Error(`join request failed: ${join.res.status} ${join.text}`);
      }
      const approve = await fetchJson(`${baseUrl}/api/party/approve`, {
        method: "POST",
        body: { joinRequestId: join.json.joinRequestId },
        headers: { cookie: dmCookie }
      });
      if (!approve.res.ok || !approve.json?.playerToken || !approve.json?.playerId) {
        throw new Error(`approve failed: ${approve.res.status} ${approve.text}`);
      }
      return { playerId: approve.json.playerId, token: approve.json.playerToken };
    }

    const playerA = await createPlayer("Player A");
    const playerB = await createPlayer("Player B");

    // Multi-tab: two sockets for A
    const socketA1 = clientIo(baseUrl, { auth: { playerToken: playerA.token } });
    const socketA2 = clientIo(baseUrl, { auth: { playerToken: playerA.token } });

    await new Promise((resolve) => socketA1.on("connect", resolve));
    await new Promise((resolve) => socketA2.on("connect", resolve));

    await sleep(100);
    const statusOnline = await getPlayerStatus(baseUrl, dmCookie, playerA.playerId);
    if (statusOnline !== "online") throw new Error(`expected online, got ${statusOnline}`);

    socketA2.disconnect();
    await sleep(Math.max(50, Math.floor(PRESENCE_GRACE_MS / 3)));
    const stillOnline = await getPlayerStatus(baseUrl, dmCookie, playerA.playerId);
    if (stillOnline !== "online") throw new Error(`false offline on multi-tab: ${stillOnline}`);

    socketA1.disconnect();
    const wentOffline = await waitForStatus(baseUrl, dmCookie, playerA.playerId, "offline", PRESENCE_GRACE_MS + 1000);
    if (!wentOffline) throw new Error("expected offline after all sockets closed");

    // Reconnect loops + p95
    const socketLoop = clientIo(baseUrl, { auth: { playerToken: playerA.token }, reconnection: false });
    await new Promise((resolve) => socketLoop.on("connect", resolve));

    const samples = [];
    let falseOffline = 0;
    for (let i = 0; i < RECONNECT_LOOPS; i += 1) {
      const tDrop = Date.now();
      socketLoop.disconnect();
      await sleep(100);
      socketLoop.connect();
      await new Promise((resolve) => socketLoop.once("connect", resolve));
      const tConn = Date.now();
      samples.push(tConn - tDrop);
      const st = await getPlayerStatus(baseUrl, dmCookie, playerA.playerId);
      if (st !== "online") falseOffline += 1;
    }
    const p95 = percentile(samples, 95);
    if (p95 != null && p95 > RECONNECT_P95_MS) {
      throw new Error(`reconnect p95 ${p95}ms exceeds ${RECONNECT_P95_MS}ms`);
    }
    const falseRate = samples.length ? (falseOffline / samples.length) : 0;
    if (falseRate > 0.01) {
      throw new Error(`false-offline rate ${Math.round(falseRate * 100)}% > 1%`);
    }

    // Auth swap A -> B
    const socketSwap = clientIo(baseUrl, { auth: { playerToken: playerA.token } });
    await new Promise((resolve) => socketSwap.on("connect", resolve));
    const swapResult = await new Promise((resolve) => {
      socketSwap.emit("auth:swap", { playerToken: playerB.token }, (res) => resolve(res));
    });
    if (!swapResult?.ok) throw new Error("auth:swap failed");

    const bOnline = await waitForStatus(baseUrl, dmCookie, playerB.playerId, "online", PRESENCE_GRACE_MS + 1000);
    if (!bOnline) throw new Error("expected B online after swap");

    // Force disconnect via kick
    const kickRes = await fetchJson(`${baseUrl}/api/party/kick`, {
      method: "POST",
      body: { playerId: playerB.playerId },
      headers: { cookie: dmCookie }
    });
    if (!kickRes.res.ok) throw new Error(`kick failed: ${kickRes.res.status} ${kickRes.text}`);
    const bOffline = await waitForStatus(baseUrl, dmCookie, playerB.playerId, "offline", PRESENCE_GRACE_MS + 1000);
    if (!bOffline) throw new Error("expected B offline after kick");

    socketLoop.disconnect();
    socketSwap.disconnect();

    console.log("CHAOS OK");
    console.log(`reconnect p95: ${p95}ms (threshold ${RECONNECT_P95_MS}ms)`);
    console.log(`false-offline rate: ${Math.round(falseRate * 10000) / 100}%`);
  } catch (err) {
    console.error("CHAOS FAILED:", err?.message || err);
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
