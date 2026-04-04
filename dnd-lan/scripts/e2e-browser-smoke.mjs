import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import net from "node:net";
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

async function assertPageHasContent(page, routePath) {
  await page.goto(routePath, { waitUntil: "networkidle" });
  const bodyText = String(await page.locator("body").innerText()).trim();
  if (!bodyText) {
    throw new Error(`empty body at ${routePath}`);
  }
  const buttonCount = await page.locator("button").count();
  const inputCount = await page.locator("input").count();
  if (buttonCount <= 0 || inputCount <= 0) {
    throw new Error(`interactive controls missing at ${routePath}`);
  }
}

async function runBrowserSmoke(baseUrl) {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({
      locale: "ru-RU",
      viewport: { width: 1366, height: 900 }
    });
    await assertPageHasContent(page, `${baseUrl}/`);
    await assertPageHasContent(page, `${baseUrl}/dm/setup`);
    const readyOk = await fetchReady(`${baseUrl}/readyz`);
    if (!readyOk) {
      throw new Error("readyz returned non-OK during browser smoke");
    }
    await page.close();
  } finally {
    await browser.close();
  }
}

async function run() {
  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-e2e-browser-smoke-"));
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

  const shutdown = async () => {
    if (server.killed) return;
    server.kill("SIGTERM");
    await new Promise((resolve) => {
      const timer = setTimeout(resolve, 3000);
      server.on("exit", () => {
        clearTimeout(timer);
        resolve();
      });
    });
  };

  try {
    if (!await waitForReady(baseUrl)) {
      throw new Error(`server not ready within ${READY_TIMEOUT_MS}ms`);
    }
    await runBrowserSmoke(baseUrl);
    console.log("E2E BROWSER SMOKE OK");
  } catch (error) {
    console.error("E2E BROWSER SMOKE FAILED:", error?.message || error);
    if (stdout.trim()) console.error("server stdout:", stdout.trim());
    if (stderr.trim()) console.error("server stderr:", stderr.trim());
    await shutdown();
    process.exit(1);
  }

  await shutdown();
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
