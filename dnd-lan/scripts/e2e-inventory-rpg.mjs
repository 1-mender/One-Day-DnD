import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const READY_TIMEOUT_MS = Number(process.env.E2E_READY_TIMEOUT_MS || 30000);
const REQUEST_TIMEOUT_MS = Number(process.env.E2E_REQUEST_TIMEOUT_MS || 6000);
const PLAYER_COOKIE = String(process.env.PLAYER_COOKIE || "player_token");
const DEBUG = process.env.E2E_DEBUG === "1";

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

function assertError(result, status, code, message) {
  if (!result?.res) throw new Error(`${message}: no response`);
  if (result.res.status !== status) {
    throw new Error(`${message}: expected ${status}, got ${result.res.status} ${result.text || ""}`);
  }
  const actual = String(result.json?.error || "");
  if (actual !== code) {
    throw new Error(`${message}: expected error "${code}", got "${actual}"`);
  }
}

async function dragPointer(
  page,
  sourceLocator,
  targetLocator,
  {
    holdMs = 0,
    syntheticDown = true,
    syntheticMove = true,
    syntheticUp = true,
    targetOffsetX = 0.5,
    targetOffsetY = 0.5
  } = {}
) {
  const sourceHandle = await sourceLocator.elementHandle();
  const targetHandle = await targetLocator.elementHandle();
  if (!sourceHandle || !targetHandle) throw new Error("drag nodes not found");
  const source = await sourceHandle.boundingBox();
  const target = await targetHandle.boundingBox();
  if (!source || !target) throw new Error("drag nodes not found");
  const sourceX = source.x + source.width / 2;
  const sourceY = source.y + source.height / 2;
  const targetX = target.x + target.width * targetOffsetX;
  const targetY = target.y + target.height * targetOffsetY;

  if (syntheticDown) {
    await sourceHandle.evaluate((el, point) => {
      el.dispatchEvent(new PointerEvent("pointerdown", {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons: 1,
        clientX: point.x,
        clientY: point.y
      }));
    }, { x: sourceX, y: sourceY });
  }

  await page.mouse.move(sourceX, sourceY);
  await page.mouse.down();
  if (holdMs > 0) await page.waitForTimeout(holdMs);
  if (syntheticMove) {
    await page.evaluate(({ sourceX: sx, sourceY: sy, targetX: tx, targetY: ty }) => {
      const steps = 12;
      for (let i = 1; i <= steps; i += 1) {
        const t = i / steps;
        const x = sx + (tx - sx) * t;
        const y = sy + (ty - sy) * t;
        document.dispatchEvent(new PointerEvent("pointermove", {
          bubbles: true,
          cancelable: true,
          composed: true,
          pointerId: 1,
          pointerType: "mouse",
          isPrimary: true,
          buttons: 1,
          clientX: x,
          clientY: y
        }));
      }
    }, { sourceX, sourceY, targetX, targetY });
  }
  await page.mouse.move(targetX, targetY, { steps: 12 });
  if (syntheticUp) {
    await page.evaluate(({ targetX: x, targetY: y }) => {
      document.dispatchEvent(new PointerEvent("pointerup", {
        bubbles: true,
        cancelable: true,
        composed: true,
        pointerId: 1,
        pointerType: "mouse",
        isPrimary: true,
        button: 0,
        buttons: 0,
        clientX: x,
        clientY: y
      }));
    }, { targetX, targetY });
  }
  await page.mouse.up();
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
  return { playerToken };
}

async function runScenario({ clientBaseUrl, serverBaseUrl, playerToken }) {
  const createSword = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    method: "POST",
    headers: { "x-player-token": playerToken },
    body: { name: "Sword", qty: 4, weight: 1 }
  });
  assertOk(createSword, "create sword failed");
  const swordId = Number(createSword.json?.id || 0);
  if (!swordId) throw new Error("sword id missing");

  const createShield = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    method: "POST",
    headers: { "x-player-token": playerToken },
    body: { name: "Shield", qty: 1, weight: 1 }
  });
  assertOk(createShield, "create shield failed");
  const shieldId = Number(createShield.json?.id || 0);
  if (!shieldId) throw new Error("shield id missing");

  const before = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    headers: { "x-player-token": playerToken }
  });
  assertOk(before, "inventory read failed");
  const swordBefore = (before.json?.items || []).find((item) => item.id === swordId);
  if (!swordBefore) throw new Error("sword not found before drag");

  const browser = await chromium.launch({ headless: true });
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
    if (DEBUG) {
      page.on("request", (req) => {
        if (req.url().includes("/api/inventory/")) {
          console.log(`[debug:req] ${req.method()} ${req.url()}`);
        }
      });
      page.on("response", (res) => {
        if (res.url().includes("/api/inventory/")) {
          console.log(`[debug:res] ${res.status()} ${res.url()}`);
        }
      });
    }
    await page.goto(`${clientBaseUrl}/app/inventory?view=slots`, { waitUntil: "networkidle" });
    await page.waitForSelector(".inv-slot-zone", { timeout: 12000 });

    const sourceSelector = `[data-slot="backpack:${swordBefore.slotX}:${swordBefore.slotY}"] .inv-slot-handle`;
    const targetSelector = `[data-slot="equipment:0:0"]`;
    const sourceHandle = page.locator(sourceSelector);
    await sourceHandle.waitFor({ timeout: 10000 });
    if (DEBUG) {
      const disabled = await sourceHandle.isDisabled().catch(() => false);
      console.log(`[debug] source slot backpack:${swordBefore.slotX}:${swordBefore.slotY}, disabled=${disabled}`);
    }
    const [layoutResponse] = await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST" && res.url().includes("/api/inventory/mine/layout"),
        { timeout: 10000 }
      ),
      dragPointer(page, sourceHandle, page.locator(targetSelector))
    ]);
    if (!layoutResponse.ok()) {
      throw new Error(`layout drag failed with status ${layoutResponse.status()}`);
    }

    const splitHandle = page.locator('[data-slot="equipment:0:0"] .inv-slot-handle');
    const splitTarget = page.locator('[data-slot="hotbar:2:0"]');
    await dragPointer(page, splitHandle, splitTarget, {
      holdMs: 430,
      syntheticDown: true,
      syntheticMove: false,
      syntheticUp: false,
      targetOffsetY: 0.2
    });

    await page.getByText("Разделить стак").waitFor({ timeout: 10000 });
    await page.locator('input[type="number"]').first().fill("2");
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST"
          && res.url().includes(`/api/inventory/mine/${swordId}/split`)
          && res.ok(),
        { timeout: 10000 }
      ),
      page.getByRole("button", { name: "Разделить" }).click()
    ]);

    const shieldCell = page.locator(".inv-slot-cell", { hasText: "Shield" }).first();
    await shieldCell.locator(".inv-slot-menu-btn").click();
    await Promise.all([
      page.waitForResponse(
        (res) =>
          res.request().method() === "POST"
          && res.url().includes(`/api/inventory/mine/${shieldId}/quick-equip`)
          && res.ok(),
        { timeout: 10000 }
      ),
      page.getByRole("button", { name: "Быстро экипировать" }).click()
    ]);

    await context.close();
  } finally {
    await browser.close();
  }

  const after = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    headers: { "x-player-token": playerToken }
  });
  assertOk(after, "inventory read after scenario failed");
  const items = Array.isArray(after.json?.items) ? after.json.items : [];

  const swords = items.filter((item) => item.name === "Sword");
  if (swords.length !== 2) throw new Error(`expected 2 swords after split, got ${swords.length}`);
  const eqSword = swords.find((item) => item.container === "equipment" && Number(item.slotX) === 0 && Number(item.slotY) === 0);
  const splitSword = swords.find((item) => Number(item.id) !== Number(eqSword?.id || 0));
  if (!eqSword || Number(eqSword.qty) !== 2) {
    throw new Error(`equipment sword slot/qty mismatch: ${JSON.stringify(swords)}`);
  }
  if (!splitSword || Number(splitSword.qty) !== 2) {
    throw new Error(`split sword qty mismatch: ${JSON.stringify(swords)}`);
  }

  const shield = items.find((item) => item.id === shieldId);
  if (!shield) throw new Error("shield missing after quick-equip");
  if (!(shield.container === "equipment" && Number(shield.slotX) === 1 && Number(shield.slotY) === 0)) {
    throw new Error(`shield not equipped to offhand slot: ${shield.container}:${shield.slotX}:${shield.slotY}`);
  }
}

async function runConflictScenario({ serverBaseUrl, dmCookie }) {
  const { playerToken: actorToken } = await createApprovedPlayer(serverBaseUrl, dmCookie, "RPG Conflict Actor");
  const { playerToken: targetToken } = await createApprovedPlayer(serverBaseUrl, dmCookie, "RPG Conflict Target");
  if (!targetToken) throw new Error("conflict target token missing");

  const createSword = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    method: "POST",
    headers: { "x-player-token": actorToken },
    body: { name: "Sword", qty: 1, weight: 1 }
  });
  assertOk(createSword, "conflict create sword failed");
  const swordId = Number(createSword.json?.id || 0);
  if (!swordId) throw new Error("conflict sword id missing");

  const createAxe = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    method: "POST",
    headers: { "x-player-token": actorToken },
    body: { name: "Axe", qty: 1, weight: 1 }
  });
  assertOk(createAxe, "conflict create axe failed");
  const axeId = Number(createAxe.json?.id || 0);
  if (!axeId) throw new Error("conflict axe id missing");

  const invBefore = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    headers: { "x-player-token": actorToken }
  });
  assertOk(invBefore, "conflict inventory read failed");
  const itemsBefore = Array.isArray(invBefore.json?.items) ? invBefore.json.items : [];
  const sword = itemsBefore.find((item) => Number(item.id) === swordId);
  const axe = itemsBefore.find((item) => Number(item.id) === axeId);
  if (!sword || !axe) throw new Error("conflict items missing before slot conflict");

  const slotOccupied = await fetchJson(`${serverBaseUrl}/api/inventory/mine/layout`, {
    method: "POST",
    headers: { "x-player-token": actorToken },
    body: {
      moves: [
        {
          id: swordId,
          container: axe.container,
          slotX: Number(axe.slotX),
          slotY: Number(axe.slotY)
        }
      ]
    }
  });
  assertError(slotOccupied, 409, "slot_occupied", "slot conflict must return slot_occupied");

  const createPotion = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    method: "POST",
    headers: { "x-player-token": actorToken },
    body: { name: "Potion", qty: 1, weight: 0.1 }
  });
  assertOk(createPotion, "conflict create potion failed");
  const potionId = Number(createPotion.json?.id || 0);
  if (!potionId) throw new Error("conflict potion id missing");

  const invalidEquip = await fetchJson(`${serverBaseUrl}/api/inventory/mine/layout`, {
    method: "POST",
    headers: { "x-player-token": actorToken },
    body: {
      moves: [
        { id: potionId, container: "equipment", slotX: 0, slotY: 0 }
      ]
    }
  });
  assertError(invalidEquip, 400, "invalid_equipment_slot", "invalid equipment placement must fail");

  const createBundle = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    method: "POST",
    headers: { "x-player-token": actorToken },
    body: { name: "Rope Bundle", qty: 5, weight: 0.2 }
  });
  assertOk(createBundle, "conflict create reserved bundle failed");
  const bundleId = Number(createBundle.json?.id || 0);
  if (!bundleId) throw new Error("conflict bundle id missing");

  const meActor = await fetchJson(`${serverBaseUrl}/api/players/me`, {
    headers: { "x-player-token": actorToken }
  });
  assertOk(meActor, "conflict actor profile read failed");
  const meTarget = await fetchJson(`${serverBaseUrl}/api/players/me`, {
    headers: { "x-player-token": targetToken }
  });
  assertOk(meTarget, "conflict target profile read failed");
  const targetPlayerId = Number(meTarget.json?.player?.id || 0);
  if (!targetPlayerId) throw new Error("conflict target player id missing");

  const reserveTransfer = await fetchJson(`${serverBaseUrl}/api/inventory/transfers`, {
    method: "POST",
    headers: { "x-player-token": actorToken },
    body: { to_player_id: targetPlayerId, item_id: bundleId, qty: 3, note: "reserve-for-split-check" }
  });
  assertOk(reserveTransfer, "conflict reserve transfer failed");

  const splitReserved = await fetchJson(`${serverBaseUrl}/api/inventory/mine/${bundleId}/split`, {
    method: "POST",
    headers: { "x-player-token": actorToken },
    body: { qty: 2 }
  });
  assertError(splitReserved, 400, "invalid_qty", "split must respect reserved_qty");
  if (Number(splitReserved.json?.available) !== 2) {
    throw new Error(`split reserved available mismatch: ${JSON.stringify(splitReserved.json || {})}`);
  }

  const invAfter = await fetchJson(`${serverBaseUrl}/api/inventory/mine`, {
    headers: { "x-player-token": actorToken }
  });
  assertOk(invAfter, "conflict inventory read after checks failed");
  const bundleAfter = (invAfter.json?.items || []).find((item) => Number(item.id) === bundleId);
  if (!bundleAfter) throw new Error("bundle missing after reserved split conflict");
  if (Number(bundleAfter.qty) !== 5 || Number(bundleAfter.reservedQty ?? bundleAfter.reserved_qty) !== 3) {
    throw new Error(`bundle qty/reserved changed unexpectedly: ${JSON.stringify(bundleAfter)}`);
  }

  if (Number(meActor.json?.player?.id || 0) <= 0) {
    throw new Error("conflict actor player id missing");
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
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-e2e-rpg-"));
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
    console.log(`[e2e:rpg] waiting for server ${serverBaseUrl}`);
    const serverReady = await waitForHttpOk(`${serverBaseUrl}/readyz`);
    if (!serverReady) throw new Error(`server was not ready within ${READY_TIMEOUT_MS}ms`);

    const clientEnv = {
      ...process.env,
      VITE_DEV_PROXY_TARGET: serverBaseUrl
    };
    const viteBin = path.resolve(process.cwd(), "client", "node_modules", "vite", "bin", "vite.js");

    console.log(`[e2e:rpg] starting client ${clientBaseUrl}`);
    client = spawn(
      "node",
      [viteBin, "--host", "127.0.0.1", "--port", String(clientPort), "--strictPort"],
      {
        env: clientEnv,
        stdio: ["ignore", "pipe", "pipe"],
        cwd: path.resolve(process.cwd(), "client")
      }
    );
    client.stdout.on("data", (d) => { clientStdout += d.toString(); });
    client.stderr.on("data", (d) => { clientStderr += d.toString(); });

    console.log("[e2e:rpg] waiting for client ready");
    const clientReady = await waitForHttpOk(clientBaseUrl);
    if (!clientReady) throw new Error(`client was not ready within ${READY_TIMEOUT_MS}ms`);

    const { dmCookie } = await setupDm(serverBaseUrl);
    const { playerToken } = await createApprovedPlayer(serverBaseUrl, dmCookie, "RPG Tester");

    console.log("[e2e:rpg] running inventory happy-path scenario");
    await runScenario({ clientBaseUrl, serverBaseUrl, playerToken });
    console.log("[e2e:rpg] running inventory conflict scenario");
    await runConflictScenario({ serverBaseUrl, dmCookie });

    console.log("E2E INVENTORY RPG OK");
  } catch (err) {
    console.error("E2E INVENTORY RPG FAILED:", err?.message || err);
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
