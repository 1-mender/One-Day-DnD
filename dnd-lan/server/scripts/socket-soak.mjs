import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { io as clientIo } from "socket.io-client";

const READY_TIMEOUT_MS = Number(process.env.SOCKET_SOAK_READY_TIMEOUT_MS || 15000);
const REQUEST_TIMEOUT_MS = Number(process.env.SOCKET_SOAK_REQUEST_TIMEOUT_MS || 5000);
const CONNECT_TIMEOUT_MS = Number(process.env.SOCKET_SOAK_CONNECT_TIMEOUT_MS || 10000);
const STATUS_TIMEOUT_MS = Number(process.env.SOCKET_SOAK_STATUS_TIMEOUT_MS || 8000);
const PLAYER_COUNT = Number(process.env.SOCKET_SOAK_PLAYERS || 30);
const SOAK_DURATION_MS = Number(process.env.SOCKET_SOAK_DURATION_MS || 10000);
const ACTIVITY_EVERY_MS = Number(process.env.SOCKET_SOAK_ACTIVITY_EVERY_MS || 250);
const POLL_EVERY_MS = Number(process.env.SOCKET_SOAK_POLL_EVERY_MS || 1000);
const RECONNECT_EVERY_MS = Number(process.env.SOCKET_SOAK_RECONNECT_EVERY_MS || 2500);
const RECONNECT_BATCH = Number(process.env.SOCKET_SOAK_RECONNECT_BATCH || Math.max(2, Math.floor(PLAYER_COUNT / 6)));
const PRESENCE_GRACE_MS = Number(process.env.SOCKET_SOAK_GRACE_MS || 1000);
const MIN_ONLINE_RATIO = Number(process.env.SOCKET_SOAK_MIN_ONLINE_RATIO || 0.95);
const MAX_CONNECT_P95_MS = Number(process.env.SOCKET_SOAK_CONNECT_P95_MS || 2500);
const JOIN_BATCH_SIZE = Number(process.env.SOCKET_SOAK_JOIN_BATCH_SIZE || 10);
const JOIN_BATCH_PAUSE_MS = Number(process.env.SOCKET_SOAK_JOIN_BATCH_PAUSE_MS || 10500);

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
      // retry until timeout
    }
    await sleep(200);
  }
  return false;
}

function extractCookie(res) {
  const header = res.headers.get("set-cookie") || "";
  if (!header) return "";
  return header.split(";")[0];
}

function percentile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, Math.min(sorted.length - 1, idx))];
}

async function stopProcess(proc) {
  if (!proc || proc.killed) return;
  proc.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 3000);
    proc.on("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function setupDm(baseUrl) {
  const username = "dm";
  const password = "secret123";

  const setup = await fetchJson(`${baseUrl}/api/dm/setup`, {
    method: "POST",
    body: { username, password }
  });
  if (!setup.res.ok) {
    throw new Error(`dm setup failed: ${setup.res.status} ${setup.text}`);
  }

  const login = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: { username, password }
  });
  if (!login.res.ok) {
    throw new Error(`dm login failed: ${login.res.status} ${login.text}`);
  }

  const dmCookie = extractCookie(login.res);
  if (!dmCookie) throw new Error("dm login did not return cookie");
  return dmCookie;
}

async function approvePlayer(baseUrl, dmCookie, displayName) {
  const join = await fetchJson(`${baseUrl}/api/party/join-request`, {
    method: "POST",
    body: { displayName, joinCode: "" }
  });
  if (!join.res.ok || !join.json?.joinRequestId) {
    throw new Error(`join request failed for ${displayName}: ${join.res.status} ${join.text}`);
  }

  const approve = await fetchJson(`${baseUrl}/api/party/approve`, {
    method: "POST",
    body: { joinRequestId: join.json.joinRequestId },
    headers: { cookie: dmCookie }
  });
  if (!approve.res.ok || !approve.json?.playerToken || !approve.json?.playerId) {
    throw new Error(`approve failed for ${displayName}: ${approve.res.status} ${approve.text}`);
  }
  return {
    playerId: Number(approve.json.playerId),
    playerToken: String(approve.json.playerToken),
    displayName
  };
}

async function createPlayers(baseUrl, dmCookie) {
  const players = [];
  for (let offset = 0; offset < PLAYER_COUNT; offset += JOIN_BATCH_SIZE) {
    const batchEnd = Math.min(PLAYER_COUNT, offset + JOIN_BATCH_SIZE);
    for (let idx = offset; idx < batchEnd; idx += 1) {
      players.push(await approvePlayer(baseUrl, dmCookie, `Soak Player ${idx + 1}`));
    }
    if (batchEnd < PLAYER_COUNT) {
      await sleep(JOIN_BATCH_PAUSE_MS);
    }
  }
  return players;
}

function waitForSocketEvent(socket, eventName, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`${eventName} timeout`));
    }, timeoutMs);

    function cleanup() {
      clearTimeout(timer);
      socket.off(eventName, onEvent);
      socket.off("connect_error", onError);
    }

    function onEvent(payload) {
      cleanup();
      resolve(payload);
    }

    function onError(error) {
      cleanup();
      reject(error);
    }

    socket.once(eventName, onEvent);
    socket.once("connect_error", onError);
  });
}

async function connectPlayerSocket(baseUrl, player) {
  const socket = clientIo(baseUrl, {
    auth: { playerToken: player.playerToken },
    reconnection: false,
    autoConnect: false,
    transports: ["websocket"]
  });
  const startedAt = Date.now();
  socket.connect();
  await waitForSocketEvent(socket, "connect", CONNECT_TIMEOUT_MS);
  return { player, socket, connectMs: Date.now() - startedAt };
}

async function reconnectPlayerSocket(entry) {
  const startedAt = Date.now();
  entry.socket.disconnect();
  await sleep(40 + Math.floor(Math.random() * 80));
  entry.socket.connect();
  await waitForSocketEvent(entry.socket, "connect", CONNECT_TIMEOUT_MS);
  return Date.now() - startedAt;
}

async function fetchPlayers(baseUrl, dmCookie) {
  const { res, json, text } = await fetchJson(`${baseUrl}/api/players`, {
    headers: { cookie: dmCookie }
  });
  if (!res.ok) throw new Error(`players fetch failed: ${res.status} ${text}`);
  return Array.isArray(json?.items) ? json.items : [];
}

function countOnline(players) {
  return players.filter((item) => item?.status === "online").length;
}

async function waitForOnlineCount(baseUrl, dmCookie, expectedCount, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const items = await fetchPlayers(baseUrl, dmCookie);
    if (countOnline(items) >= expectedCount) return items;
    await sleep(120);
  }
  const items = await fetchPlayers(baseUrl, dmCookie);
  throw new Error(`expected ${expectedCount} online players, got ${countOnline(items)}`);
}

async function waitForAllOffline(baseUrl, dmCookie, timeoutMs) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const items = await fetchPlayers(baseUrl, dmCookie);
    if (countOnline(items) === 0) return;
    await sleep(120);
  }
  const items = await fetchPlayers(baseUrl, dmCookie);
  throw new Error(`expected 0 online players after disconnect, got ${countOnline(items)}`);
}

function pickReconnectIndexes(playerCount, round) {
  const indexes = [];
  const step = Math.max(1, Math.floor(playerCount / RECONNECT_BATCH));
  for (let idx = round % step; idx < playerCount && indexes.length < RECONNECT_BATCH; idx += step) {
    indexes.push(idx);
  }
  return indexes;
}

async function runSoakLoop(baseUrl, dmCookie, entries) {
  const connectSamples = entries.map((entry) => entry.connectMs);
  const onlineSamples = [];
  let connectErrors = 0;
  let disconnectCount = 0;
  let reconnectRound = 0;

  const onConnectError = () => {
    connectErrors += 1;
  };
  const onDisconnect = () => {
    disconnectCount += 1;
  };

  for (const entry of entries) {
    entry.socket.on("connect_error", onConnectError);
    entry.socket.on("disconnect", onDisconnect);
  }

  const activityTimer = setInterval(() => {
    for (const entry of entries) {
      if (entry.socket.connected) {
        entry.socket.emit("player:activity");
      }
    }
  }, ACTIVITY_EVERY_MS);

  let nextReconnectAt = Date.now() + RECONNECT_EVERY_MS;
  const deadline = Date.now() + SOAK_DURATION_MS;

  try {
    while (Date.now() < deadline) {
      if (Date.now() >= nextReconnectAt) {
        const indexes = pickReconnectIndexes(entries.length, reconnectRound);
        const samples = await Promise.all(
          indexes.map((idx) => reconnectPlayerSocket(entries[idx]))
        );
        connectSamples.push(...samples);
        reconnectRound += 1;
        nextReconnectAt = Date.now() + RECONNECT_EVERY_MS;
      }

      const items = await fetchPlayers(baseUrl, dmCookie);
      onlineSamples.push(countOnline(items));
      await sleep(POLL_EVERY_MS);
    }
  } finally {
    clearInterval(activityTimer);
    for (const entry of entries) {
      entry.socket.off("connect_error", onConnectError);
      entry.socket.off("disconnect", onDisconnect);
    }
  }

  const p95 = percentile(connectSamples, 95);
  const minOnline = onlineSamples.length ? Math.min(...onlineSamples) : 0;
  const minRequiredOnline = Math.floor(entries.length * MIN_ONLINE_RATIO);

  if (p95 != null && p95 > MAX_CONNECT_P95_MS) {
    throw new Error(`connect/reconnect p95 ${p95}ms exceeds ${MAX_CONNECT_P95_MS}ms`);
  }
  if (minOnline < minRequiredOnline) {
    throw new Error(`online dip too low: min ${minOnline}/${entries.length}, required >= ${minRequiredOnline}`);
  }
  if (connectErrors > 0) {
    throw new Error(`socket connect errors observed: ${connectErrors}`);
  }

  return {
    p95,
    minOnline,
    maxOnline: onlineSamples.length ? Math.max(...onlineSamples) : 0,
    disconnectCount,
    reconnectRound
  };
}

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-socket-soak-"));
  const port = process.env.SOCKET_SOAK_PORT ? Number(process.env.SOCKET_SOAK_PORT) : await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const server = spawn("node", ["src/index.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      LOG_LEVEL: process.env.LOG_LEVEL || "warn",
      DND_LAN_DATA_DIR: dataDir,
      READINESS_CHECK_EVERY_MS: "2000",
      CLEANUP_EVERY_MS: "0",
      TRANSFER_CLEANUP_EVERY_MS: "0",
      PRESENCE_GRACE_MS: String(PRESENCE_GRACE_MS)
    },
    stdio: ["ignore", "pipe", "pipe"]
  });

  let stdout = "";
  let stderr = "";
  server.stdout.on("data", (chunk) => {
    stdout += chunk.toString();
  });
  server.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  try {
    if (!await waitForReady(baseUrl)) {
      throw new Error(`server not ready within ${READY_TIMEOUT_MS}ms`);
    }

    const dmCookie = await setupDm(baseUrl);
    const players = await createPlayers(baseUrl, dmCookie);
    const entries = await Promise.all(players.map((player) => connectPlayerSocket(baseUrl, player)));

    await waitForOnlineCount(baseUrl, dmCookie, PLAYER_COUNT, STATUS_TIMEOUT_MS);
    const result = await runSoakLoop(baseUrl, dmCookie, entries);

    for (const entry of entries) {
      entry.socket.disconnect();
    }
    await waitForAllOffline(baseUrl, dmCookie, PRESENCE_GRACE_MS + STATUS_TIMEOUT_MS);

    console.log("SOCKET SOAK OK");
    console.log(`players: ${PLAYER_COUNT}`);
    console.log(`duration: ${SOAK_DURATION_MS}ms`);
    console.log(`connect/reconnect p95: ${result.p95}ms (threshold ${MAX_CONNECT_P95_MS}ms)`);
    console.log(`online range: ${result.minOnline}-${result.maxOnline}/${PLAYER_COUNT}`);
    console.log(`reconnect rounds: ${result.reconnectRound}, disconnect events: ${result.disconnectCount}`);
  } catch (error) {
    console.error("SOCKET SOAK FAILED:", error?.message || error);
    if (stdout.trim()) console.error("server stdout:", stdout.trim());
    if (stderr.trim()) console.error("server stderr:", stderr.trim());
    await stopProcess(server);
    process.exit(1);
  }

  await stopProcess(server);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
