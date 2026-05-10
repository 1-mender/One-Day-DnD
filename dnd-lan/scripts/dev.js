const { spawn } = require("child_process");
const http = require("http");
const https = require("https");

let shuttingDown = false;
const children = [];
const serverPort = Number(process.env.PORT || 3000);
const readyUrl = process.env.DEV_SERVER_READY_URL || `http://127.0.0.1:${serverPort}/readyz`;
const readyTimeoutMs = Number(process.env.DEV_SERVER_READY_TIMEOUT_MS || 60000);
const readyPollMs = Number(process.env.DEV_SERVER_READY_POLL_MS || 500);

function runNpm(prefix) {
  const child = spawn(
    "npm",
    ["--prefix", prefix, "run", "dev"],
    { stdio: "inherit", shell: true }
  );

  child.on("exit", (code) => {
    if (shuttingDown) return;
    shuttingDown = true;
    for (const proc of children) {
      if (proc && !proc.killed) proc.kill();
    }
    process.exit(code ?? 0);
  });

  return child;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isReady(url) {
  return new Promise((resolve) => {
    let parsed;
    try {
      parsed = new URL(url);
    } catch {
      resolve(false);
      return;
    }
    const transport = parsed.protocol === "https:" ? https : http;
    const req = transport.request(parsed, { method: "GET", timeout: 2000 }, (res) => {
      // Drain response to free socket.
      res.resume();
      resolve(Number(res.statusCode) === 200);
    });
    req.on("timeout", () => req.destroy());
    req.on("error", () => resolve(false));
    req.end();
  });
}

async function waitForServerReady(url, timeoutMs, pollMs) {
  const startedAt = Date.now();
  while (!shuttingDown && (Date.now() - startedAt) < timeoutMs) {
    const ok = await isReady(url);
    if (ok) return true;
    await sleep(pollMs);
  }
  return false;
}

async function start() {
  children.push(runNpm("server"));

  const ok = await waitForServerReady(readyUrl, readyTimeoutMs, readyPollMs);
  if (!ok) {
    if (!shuttingDown) {
      shuttingDown = true;
      console.error(`[dev] Server was not ready at ${readyUrl} within ${readyTimeoutMs}ms`);
      for (const proc of children) {
        if (proc && !proc.killed) proc.kill();
      }
      process.exit(1);
    }
    return;
  }

  console.log(`[dev] Server ready: ${readyUrl}`);
  children.push(runNpm("client"));
}

start().catch((err) => {
  if (!shuttingDown) {
    shuttingDown = true;
    console.error("[dev] Failed to start dev environment", err);
    for (const proc of children) {
      if (proc && !proc.killed) proc.kill();
    }
    process.exit(1);
  }
});

process.on("SIGINT", () => {
  if (shuttingDown) return;
  shuttingDown = true;
  for (const proc of children) {
    if (proc && !proc.killed) proc.kill();
  }
  process.exit(0);
});
