import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawn } from "node:child_process";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";
import { chromium } from "playwright";

const READY_TIMEOUT_MS = Number(process.env.E2E_READY_TIMEOUT_MS || 20000);
const REQUEST_TIMEOUT_MS = Number(process.env.E2E_REQUEST_TIMEOUT_MS || 5000);
const VISUAL_MAX_DIFF_PIXELS = Number(process.env.VISUAL_MAX_DIFF_PIXELS || 350);
const VISUAL_UPDATE_BASELINE = process.env.VISUAL_UPDATE_BASELINE === "1";

const VISUAL_CASES = [
  { name: "join-desktop", path: "/", viewport: { width: 1366, height: 900 } },
  { name: "join-mobile", path: "/", viewport: { width: 390, height: 844 } },
  { name: "dm-setup-desktop", path: "/dm/setup", viewport: { width: 1366, height: 900 } },
  { name: "dm-setup-mobile", path: "/dm/setup", viewport: { width: 390, height: 844 } }
];

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
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
    return res;
  } finally {
    clearTimeout(timer);
  }
}

async function waitForReady(baseUrl) {
  const started = Date.now();
  while (Date.now() - started < READY_TIMEOUT_MS) {
    try {
      const res = await fetchJson(`${baseUrl}/readyz`);
      if (res.ok) return true;
    } catch {
      // ignore
    }
    await sleep(250);
  }
  return false;
}

function cleanDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  ensureDir(dir);
}

function readPng(filePath) {
  return PNG.sync.read(fs.readFileSync(filePath));
}

function writePng(filePath, png) {
  fs.writeFileSync(filePath, PNG.sync.write(png));
}

async function captureSnapshots(baseUrl, currentDir) {
  const browser = await chromium.launch({ headless: true });
  try {
    for (const testCase of VISUAL_CASES) {
      const context = await browser.newContext({
        viewport: testCase.viewport,
        colorScheme: "light",
        locale: "ru-RU",
        timezoneId: "Europe/Moscow"
      });
      const page = await context.newPage();
      await page.goto(`${baseUrl}${testCase.path}`, { waitUntil: "networkidle" });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.addStyleTag({
        content: `
          *, *::before, *::after {
            animation: none !important;
            transition: none !important;
            caret-color: transparent !important;
          }
        `
      });
      if (testCase.path === "/") {
        await page.addStyleTag({
          content: `
            .qr-wrap,
            .qr-url,
            .spread-col .list .item:first-child .small {
              visibility: hidden !important;
            }
          `
        });
      }
      await sleep(200);
      await page.screenshot({
        path: path.join(currentDir, `${testCase.name}.png`),
        fullPage: true
      });
      await context.close();
    }
  } finally {
    await browser.close();
  }
}

function compareSnapshots({ baselineDir, currentDir, diffDir }) {
  let failed = 0;
  let updated = 0;
  let checked = 0;

  for (const testCase of VISUAL_CASES) {
    const fileName = `${testCase.name}.png`;
    const baselinePath = path.join(baselineDir, fileName);
    const currentPath = path.join(currentDir, fileName);
    const diffPath = path.join(diffDir, fileName);

    if (!fs.existsSync(currentPath)) {
      failed += 1;
      console.error(`[visual] missing current snapshot: ${fileName}`);
      continue;
    }

    if (!fs.existsSync(baselinePath)) {
      if (VISUAL_UPDATE_BASELINE) {
        fs.copyFileSync(currentPath, baselinePath);
        updated += 1;
        console.log(`[visual] baseline created: ${fileName}`);
        continue;
      }
      failed += 1;
      console.error(`[visual] missing baseline snapshot: ${fileName}`);
      continue;
    }

    checked += 1;
    const baseline = readPng(baselinePath);
    const current = readPng(currentPath);

    if (baseline.width !== current.width || baseline.height !== current.height) {
      if (VISUAL_UPDATE_BASELINE) {
        fs.copyFileSync(currentPath, baselinePath);
        updated += 1;
        console.log(`[visual] baseline updated (size): ${fileName}`);
        continue;
      }
      failed += 1;
      console.error(`[visual] size mismatch for ${fileName}: baseline=${baseline.width}x${baseline.height}, current=${current.width}x${current.height}`);
      continue;
    }

    const diff = new PNG({ width: baseline.width, height: baseline.height });
    const mismatched = pixelmatch(
      baseline.data,
      current.data,
      diff.data,
      baseline.width,
      baseline.height,
      {
        threshold: 0.1,
        includeAA: false
      }
    );

    if (mismatched > VISUAL_MAX_DIFF_PIXELS) {
      if (VISUAL_UPDATE_BASELINE) {
        fs.copyFileSync(currentPath, baselinePath);
        if (fs.existsSync(diffPath)) fs.rmSync(diffPath, { force: true });
        updated += 1;
        console.log(`[visual] baseline updated: ${fileName} (${mismatched} pixels)`);
        continue;
      }
      failed += 1;
      writePng(diffPath, diff);
      console.error(`[visual] diff failed ${fileName}: ${mismatched} pixels (limit ${VISUAL_MAX_DIFF_PIXELS})`);
      continue;
    }

    if (fs.existsSync(diffPath)) fs.rmSync(diffPath, { force: true });
    console.log(`[visual] ok ${fileName}: ${mismatched} pixels`);
  }

  return { failed, updated, checked };
}

async function run() {
  const artifactsRoot = path.resolve(process.cwd(), "artifacts", "visual");
  const baselineDir = path.join(artifactsRoot, "baseline");
  const currentDir = path.join(artifactsRoot, "current");
  const diffDir = path.join(artifactsRoot, "diff");
  ensureDir(baselineDir);
  cleanDir(currentDir);
  cleanDir(diffDir);

  const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "dnd-lan-visual-"));
  const port = Number(process.env.E2E_PORT || 3900);
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

    await captureSnapshots(baseUrl, currentDir);
    const result = compareSnapshots({ baselineDir, currentDir, diffDir });

    console.log(`[visual] checked: ${result.checked}, updated: ${result.updated}, failed: ${result.failed}`);

    if (result.failed > 0) {
      throw new Error(`visual regression failed (${result.failed})`);
    }
  } catch (error) {
    console.error("VISUAL E2E FAILED:", error?.message || error);
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
