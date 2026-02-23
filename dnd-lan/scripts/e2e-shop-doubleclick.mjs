import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const READY_TIMEOUT_MS = Number(process.env.E2E_READY_TIMEOUT_MS || 30000);
const REQUEST_TIMEOUT_MS = Number(process.env.E2E_REQUEST_TIMEOUT_MS || 6000);
const PLAYER_COOKIE = String(process.env.PLAYER_COOKIE || "player_token");

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

async function waitForHttpOk(url, timeoutMs = READY_TIMEOUT_MS) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    try {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
      const res = await fetch(url, { method: "GET", signal: ctrl.signal });
      clearTimeout(timer);
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await sleep(250);
  }
  return false;
}

function extractCookie(res) {
  const header = res.headers.get("set-cookie") || "";
  if (!header) return "";
  return header.split(";")[0];
}

function assertOk(result, message) {
  if (result?.res?.ok) return;
  const status = result?.res?.status;
  const text = result?.text;
  throw new Error(`${message}: ${status} ${text}`);
}

async function setupPlayer(baseUrl) {
  const setup = await fetchJson(`${baseUrl}/api/dm/setup`, {
    method: "POST",
    body: { username: "dm", password: "secret123" }
  });
  assertOk(setup, "dm setup failed");

  const login = await fetchJson(`${baseUrl}/api/auth/login`, {
    method: "POST",
    body: { username: "dm", password: "secret123" }
  });
  assertOk(login, "dm login failed");

  const dmCookie = extractCookie(login.res);
  if (!dmCookie) throw new Error("dm login did not return cookie");

  const join = await fetchJson(`${baseUrl}/api/party/join-request`, {
    method: "POST",
    body: { displayName: "Player One", joinCode: "" }
  });
  assertOk(join, "join request failed");
  const joinRequestId = String(join.json?.joinRequestId || "");
  if (!joinRequestId) throw new Error("join request id missing");

  const approve = await fetchJson(`${baseUrl}/api/party/approve`, {
    method: "POST",
    headers: { cookie: dmCookie },
    body: { joinRequestId }
  });
  assertOk(approve, "approve failed");

  const playerToken = String(approve.json?.playerToken || "");
  if (!playerToken) throw new Error("player token missing");

  const me = await fetchJson(`${baseUrl}/api/players/me`, {
    headers: { "x-player-token": playerToken }
  });
  assertOk(me, "player/me failed");
  const playerId = Number(me.json?.player?.id || 0);
  if (!playerId) throw new Error("player id missing");

  const adjust = await fetchJson(`${baseUrl}/api/tickets/dm/adjust`, {
    method: "POST",
    headers: { cookie: dmCookie },
    body: { playerId, set: 100, reason: "e2e double click" }
  });
  assertOk(adjust, "tickets adjust failed");

  return { playerToken };
}

async function runShopDoubleClick({ clientBaseUrl, serverBaseUrl, playerToken }) {
  const browser = await chromium.launch({ headless: true });
  let purchasePosts = 0;

  try {
    const context = await browser.newContext({ locale: "ru-RU" });
    await context.addCookies([
      {
        name: PLAYER_COOKIE,
        value: playerToken,
        url: clientBaseUrl
      }
    ]);

    const page = await context.newPage();
    page.on("request", (req) => {
      if (req.method() !== "POST") return;
      if (!req.url().includes("/api/tickets/purchase")) return;
      purchasePosts += 1;
    });

    await page.goto(`${clientBaseUrl}/app/shop`, { waitUntil: "networkidle" });
    await page.waitForSelector(".tavern-shop", { timeout: 12000 });
    await page.waitForFunction(() => {
      return !!document.querySelector(".tavern-shop .shop-card .btn.secondary:not([disabled])");
    }, { timeout: 12000 });

    const clicked = await page.evaluate(() => {
      const btn = document.querySelector(".tavern-shop .shop-card .btn.secondary:not([disabled])");
      if (!btn) return false;
      btn.click();
      btn.click();
      return true;
    });

    if (!clicked) throw new Error("buy button was not clickable");

    await page.waitForResponse(
      (res) => res.request().method() === "POST" && res.url().includes("/api/tickets/purchase"),
      { timeout: 8000 }
    );

    await sleep(500);

    if (purchasePosts !== 1) {
      throw new Error(`expected exactly 1 POST /api/tickets/purchase, got ${purchasePosts}`);
    }

    const tickets = await fetchJson(`${serverBaseUrl}/api/tickets/me`, {
      headers: { "x-player-token": playerToken }
    });
    assertOk(tickets, "tickets/me failed");
    const purchasesToday = tickets.json?.usage?.purchasesToday || {};
    const totalPurchases = Object.values(purchasesToday).reduce((sum, value) => sum + Number(value || 0), 0);

    if (totalPurchases !== 1) {
      throw new Error(`expected 1 purchase in usage.purchasesToday, got ${totalPurchases}`);
    }

    await context.close();
  } finally {
    await browser.close();
  }
}

async function stopProcess(proc) {
  if (!proc || proc.killed) return;
  proc.kill("SIGTERM");
  await new Promise((resolve) => {
    const timer = setTimeout(resolve, 4000);
    proc.on("exit", () => {
      clearTimeout(timer);
      resolve();
    });
  });
}

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-e2e-shop-"));
  const serverPort = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : await getFreePort();
  const clientPort = process.env.E2E_CLIENT_PORT ? Number(process.env.E2E_CLIENT_PORT) : await getFreePort();

  const serverBaseUrl = `http://127.0.0.1:${serverPort}`;
  const clientBaseUrl = `http://127.0.0.1:${clientPort}`;

  const serverEnv = {
    ...process.env,
    PORT: String(serverPort),
    NODE_ENV: "test",
    LOG_LEVEL: process.env.LOG_LEVEL || "warn",
    DND_LAN_DATA_DIR: dataDir,
    READINESS_CHECK_EVERY_MS: "2000",
    CLEANUP_EVERY_MS: "0",
    TRANSFER_CLEANUP_EVERY_MS: "0"
  };

  const server = spawn("node", ["server/src/index.js"], {
    env: serverEnv,
    stdio: ["ignore", "pipe", "pipe"]
  });

  let serverStdout = "";
  let serverStderr = "";
  server.stdout.on("data", (d) => { serverStdout += d.toString(); });
  server.stderr.on("data", (d) => { serverStderr += d.toString(); });

  let client = null;
  let clientStdout = "";
  let clientStderr = "";

  try {
    console.log(`[e2e:shop] waiting for server ${serverBaseUrl}`);
    const serverReady = await waitForHttpOk(`${serverBaseUrl}/readyz`);
    if (!serverReady) throw new Error(`server was not ready within ${READY_TIMEOUT_MS}ms`);

    const clientEnv = {
      ...process.env,
      VITE_DEV_PROXY_TARGET: serverBaseUrl
    };
    const viteBin = path.resolve(process.cwd(), "client", "node_modules", "vite", "bin", "vite.js");

    console.log(`[e2e:shop] starting client ${clientBaseUrl}`);
    client = spawn(
      "node",
      [
        viteBin,
        "--host",
        "127.0.0.1",
        "--port",
        String(clientPort),
        "--strictPort"
      ],
      {
        env: clientEnv,
        stdio: ["ignore", "pipe", "pipe"],
        cwd: path.resolve(process.cwd(), "client")
      }
    );

    client.stdout.on("data", (d) => { clientStdout += d.toString(); });
    client.stderr.on("data", (d) => { clientStderr += d.toString(); });

    console.log("[e2e:shop] waiting for client ready");
    const clientReady = await waitForHttpOk(clientBaseUrl);
    if (!clientReady) throw new Error(`client was not ready within ${READY_TIMEOUT_MS}ms`);

    console.log("[e2e:shop] preparing dm/player");
    const { playerToken } = await setupPlayer(serverBaseUrl);
    console.log("[e2e:shop] running browser scenario");
    await runShopDoubleClick({ clientBaseUrl, serverBaseUrl, playerToken });

    console.log("E2E SHOP DOUBLE CLICK OK");
  } catch (err) {
    console.error("E2E SHOP DOUBLE CLICK FAILED:", err?.message || err);
    if (serverStdout.trim()) console.error("server stdout:", serverStdout.trim());
    if (serverStderr.trim()) console.error("server stderr:", serverStderr.trim());
    if (clientStdout.trim()) console.error("client stdout:", clientStdout.trim());
    if (clientStderr.trim()) console.error("client stderr:", clientStderr.trim());
    await stopProcess(client);
    await stopProcess(server);
    process.exit(1);
  }

  await stopProcess(client);
  await stopProcess(server);
  process.exit(0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
