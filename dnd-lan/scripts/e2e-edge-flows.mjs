import fs from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { chromium } from "playwright";

const READY_TIMEOUT_MS = Number(process.env.E2E_READY_TIMEOUT_MS || 20000);
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

async function fetchReady(url) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    return res.ok;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForReady(baseUrl) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < READY_TIMEOUT_MS) {
    try {
      if (await fetchReady(`${baseUrl}/readyz`)) return true;
    } catch {
      // retry until timeout
    }
    await sleep(250);
  }
  return false;
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

async function completeDmSetup(dmPage, baseUrl) {
  await dmPage.goto(`${baseUrl}/dm/setup`, { waitUntil: "networkidle" });
  await dmPage.getByLabel("Логин").fill("dm");
  await dmPage.getByLabel("Пароль (минимум 6 символов)").fill("secret123");
  await dmPage.getByLabel("Секрет первичной настройки (необязательно)").fill("");
  await dmPage.getByRole("button", { name: "Создать" }).click();
  await dmPage.waitForURL("**/dm/app/dashboard", { timeout: 12000 });
}

async function runStaleWaitingFlow(playerPage, baseUrl) {
  await playerPage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await playerPage.evaluate(() => {
    window.localStorage.setItem("dnd_join_request_id", "missing_edge_request");
  });
  await playerPage.goto(`${baseUrl}/waiting`, { waitUntil: "networkidle" });
  await playerPage.getByText("Заявка отклонена.", { exact: true }).waitFor({
    state: "visible",
    timeout: 12000
  });

  await Promise.all([
    playerPage.waitForURL(baseUrl + "/", { timeout: 12000 }),
    playerPage.getByRole("button", { name: "Назад" }).click()
  ]);
  await playerPage.getByRole("button", { name: "Отправить заявку" }).waitFor({
    state: "visible",
    timeout: 12000
  });
}

async function approvePlayerInDmLobby(dmPage, baseUrl, displayName) {
  await dmPage.goto(`${baseUrl}/dm/app/lobby`, { waitUntil: "networkidle" });
  await dmPage.getByText("Лобби / Подключения", { exact: true }).waitFor({
    state: "visible",
    timeout: 12000
  });
  await dmPage.getByText(displayName, { exact: true }).waitFor({
    state: "visible",
    timeout: 12000
  });
  await dmPage.getByRole("button", { name: "Принять" }).first().click();
}

async function joinAndKickPlayer(dmPage, playerPage, baseUrl, displayName) {
  await playerPage.goto(`${baseUrl}/`, { waitUntil: "networkidle" });
  await playerPage.getByLabel("Имя игрока/персонажа *").fill(displayName);
  await Promise.all([
    playerPage.waitForURL("**/waiting", { timeout: 12000 }),
    playerPage.getByRole("button", { name: "Отправить заявку" }).click()
  ]);

  await approvePlayerInDmLobby(dmPage, baseUrl, displayName);
  await playerPage.waitForURL("**/app/players", { timeout: 12000 });
  await playerPage.getByText(displayName, { exact: true }).waitFor({
    state: "visible",
    timeout: 12000
  });

  await dmPage.goto(`${baseUrl}/dm/app/players`, { waitUntil: "networkidle" });
  await dmPage.getByText(displayName, { exact: true }).first().click();
  await Promise.all([
    playerPage.waitForURL(baseUrl + "/", { timeout: 12000 }),
    dmPage.getByRole("button", { name: "Кикнуть" }).click()
  ]);

  await playerPage.getByRole("button", { name: "Отправить заявку" }).waitFor({
    state: "visible",
    timeout: 12000
  });
}

async function runEdgeFlows(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  const dmContext = await browser.newContext({
    locale: "ru-RU",
    viewport: { width: 1366, height: 900 }
  });
  const playerContext = await browser.newContext({
    locale: "ru-RU",
    viewport: { width: 390, height: 844 }
  });
  const dmPage = await dmContext.newPage();
  const playerPage = await playerContext.newPage();

  try {
    await completeDmSetup(dmPage, baseUrl);
    await runStaleWaitingFlow(playerPage, baseUrl);
    await joinAndKickPlayer(dmPage, playerPage, baseUrl, "Edge Hero");
  } finally {
    await playerContext.close();
    await dmContext.close();
    await browser.close();
  }
}

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-e2e-edge-flows-"));
  const port = process.env.E2E_PORT ? Number(process.env.E2E_PORT) : await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;

  const server = spawn("node", ["server/src/index.js"], {
    env: {
      ...process.env,
      PORT: String(port),
      NODE_ENV: "test",
      LOG_LEVEL: process.env.LOG_LEVEL || "warn",
      DND_LAN_DATA_DIR: dataDir,
      READINESS_CHECK_EVERY_MS: "2000",
      CLEANUP_EVERY_MS: "0",
      TRANSFER_CLEANUP_EVERY_MS: "0"
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
    await runEdgeFlows(baseUrl);
    console.log("E2E EDGE FLOWS OK");
  } catch (error) {
    console.error("E2E EDGE FLOWS FAILED:", error?.message || error);
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
