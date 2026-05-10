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

async function setupDm(baseUrl) {
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
  return { dmCookie };
}

async function createApprovedPlayer(baseUrl, dmCookie, displayName) {
  const join = await fetchJson(`${baseUrl}/api/party/join-request`, {
    method: "POST",
    body: { displayName, joinCode: "" }
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

  return { playerToken, playerId };
}

async function waitForCondition(checkFn, timeoutMs, message) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const ok = await checkFn();
    if (ok) return;
    await sleep(250);
  }
  throw new Error(message);
}

async function runTransfersScenario({ clientBaseUrl, serverBaseUrl, sender, receiver }) {
  const createItem = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    method: "POST",
    headers: { "x-player-token": sender.playerToken },
    body: { name: "Torch", qty: 3, weight: 1 }
  });
  assertOk(createItem, "sender inventory create failed");
  const itemId = Number(createItem.json?.id || 0);
  if (!itemId) throw new Error("created item id missing");

  const createTransfer = await fetchJson(`${serverBaseUrl}/api/inventory/transfers`, {
    method: "POST",
    headers: { "x-player-token": sender.playerToken },
    body: {
      to_player_id: receiver.playerId,
      item_id: itemId,
      qty: 2,
      note: "e2e transfer"
    }
  });
  assertOk(createTransfer, "transfer create failed");

  const browser = await chromium.launch({ headless: true });
  try {
    const context = await browser.newContext({ locale: "ru-RU" });
    await context.addCookies([
      {
        name: PLAYER_COOKIE,
        value: receiver.playerToken,
        url: clientBaseUrl
      }
    ]);

    const page = await context.newPage();
    await page.goto(`${clientBaseUrl}/app/inventory`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Передачи" }).click();
    await page.waitForURL("**/app/transfers");
    await page.waitForSelector(".inventory-shell", { timeout: 12000 });

    const inboxItem = page.locator(".inv-transfer-grid .inv-transfer .item").first();
    await inboxItem.getByText("Torch").waitFor({ timeout: 12000 });
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST"
          && res.url().includes("/api/inventory/transfers/")
          && res.url().includes("/accept")
          && res.ok(),
        { timeout: 10000 }
      ),
      inboxItem.getByRole("button", { name: "Принять" }).click()
    ]);

    await waitForCondition(async () => {
      const inbox = await fetchJson(`${serverBaseUrl}/api/inventory/transfers/inbox`, {
        headers: { "x-player-token": receiver.playerToken }
      });
      return inbox.res.ok && Array.isArray(inbox.json?.items) && inbox.json.items.length === 0;
    }, 10000, "receiver inbox did not become empty after accept");

    await context.close();
  } finally {
    await browser.close();
  }

  const senderInv = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    headers: { "x-player-token": sender.playerToken }
  });
  assertOk(senderInv, "sender inventory read failed");
  const senderTorch = (senderInv.json?.items || []).find((item) => item.name === "Torch");
  if (!senderTorch || Number(senderTorch.qty) !== 1) {
    throw new Error(`sender item qty expected 1, got ${senderTorch ? senderTorch.qty : "missing"}`);
  }

  const receiverInv = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    headers: { "x-player-token": receiver.playerToken }
  });
  assertOk(receiverInv, "receiver inventory read failed");
  const receiverTorch = (receiverInv.json?.items || []).find((item) => item.name === "Torch");
  if (!receiverTorch || Number(receiverTorch.qty) !== 2) {
    throw new Error(`receiver item qty expected 2, got ${receiverTorch ? receiverTorch.qty : "missing"}`);
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-e2e-transfers-"));
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
  server.stdout.on("data", (d) => {
    serverStdout += d.toString();
  });
  server.stderr.on("data", (d) => {
    serverStderr += d.toString();
  });

  let client = null;
  let clientStdout = "";
  let clientStderr = "";

  try {
    console.log(`[e2e:transfers] waiting for server ${serverBaseUrl}`);
    const serverReady = await waitForHttpOk(`${serverBaseUrl}/readyz`);
    if (!serverReady) throw new Error(`server was not ready within ${READY_TIMEOUT_MS}ms`);

    const clientEnv = {
      ...process.env,
      VITE_DEV_PROXY_TARGET: serverBaseUrl
    };
    const viteBin = path.resolve(process.cwd(), "client", "node_modules", "vite", "bin", "vite.js");

    console.log(`[e2e:transfers] starting client ${clientBaseUrl}`);
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

    client.stdout.on("data", (d) => {
      clientStdout += d.toString();
    });
    client.stderr.on("data", (d) => {
      clientStderr += d.toString();
    });

    console.log("[e2e:transfers] waiting for client ready");
    const clientReady = await waitForHttpOk(clientBaseUrl);
    if (!clientReady) throw new Error(`client was not ready within ${READY_TIMEOUT_MS}ms`);

    const { dmCookie } = await setupDm(serverBaseUrl);
    const sender = await createApprovedPlayer(serverBaseUrl, dmCookie, "Sender One");
    const receiver = await createApprovedPlayer(serverBaseUrl, dmCookie, "Receiver Two");

    console.log("[e2e:transfers] running browser scenario");
    await runTransfersScenario({ clientBaseUrl, serverBaseUrl, sender, receiver });

    console.log("E2E TRANSFERS OK");
  } catch (err) {
    console.error("E2E TRANSFERS FAILED:", err?.message || err);
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
