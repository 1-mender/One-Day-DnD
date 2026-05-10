import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const manifestPath = path.join(root, "client", "dist", ".vite", "manifest.json");
const assetsDir = path.join(root, "client", "dist", "assets");
const imageExts = new Set([".png", ".jpg", ".jpeg", ".webp", ".avif", ".gif", ".svg"]);

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

function listAssets() {
  if (!fs.existsSync(assetsDir)) {
    console.error(`Missing build output: ${assetsDir}`);
    console.error("Run: npm run build");
    process.exit(1);
  }

  return fs.readdirSync(assetsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => {
      const full = path.join(assetsDir, entry.name);
      const stat = fs.statSync(full);
      return {
        name: entry.name,
        ext: path.extname(entry.name).toLowerCase(),
        bytes: stat.size
      };
    });
}

function printTop(title, rows, count = 10) {
  console.log(title);
  const top = rows.sort((a, b) => b.bytes - a.bytes).slice(0, count);
  if (!top.length) {
    console.log("- none");
    return;
  }
  for (const row of top) {
    console.log(`- ${row.name} | ${row.bytes} bytes | ${formatBytes(row.bytes)}`);
  }
}

function parseBudget(name, fallback = null) {
  const raw = process.env[name];
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function loadManifest() {
  if (!fs.existsSync(manifestPath)) return null;
  try {
    return JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  } catch {
    return null;
  }
}

function collectInitialJsAssetNames(manifest) {
  if (!manifest || typeof manifest !== "object") return null;

  const names = new Set();
  const queue = Object.entries(manifest)
    .filter(([, entry]) => entry?.isEntry && entry?.file)
    .map(([key]) => key);
  const visited = new Set();

  while (queue.length) {
    const key = queue.pop();
    if (visited.has(key)) continue;
    visited.add(key);

    const entry = manifest[key];
    if (!entry || typeof entry !== "object") continue;

    const fileName = path.basename(String(entry.file || ""));
    if (fileName.endsWith(".js")) names.add(fileName);

    const imports = Array.isArray(entry.imports) ? entry.imports : [];
    for (const childKey of imports) {
      if (typeof childKey === "string" && manifest[childKey] && !visited.has(childKey)) {
        queue.push(childKey);
      }
    }
  }

  return names;
}

function parseCliBudget(raw, fallback = null) {
  if (raw == null || String(raw).trim() === "") return fallback;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.floor(n);
}

function parseCliArgs(argv) {
  const out = {
    enforce: false,
    jsTotal: null,
    initialJsTotal: null,
    largestJs: null,
    imageTotal: null,
    largestImage: null
  };
  for (const arg of argv) {
    if (arg === "--enforce") {
      out.enforce = true;
      continue;
    }
    if (arg.startsWith("--js-total=")) {
      out.jsTotal = parseCliBudget(arg.slice("--js-total=".length), out.jsTotal);
      continue;
    }
    if (arg.startsWith("--largest-js=")) {
      out.largestJs = parseCliBudget(arg.slice("--largest-js=".length), out.largestJs);
      continue;
    }
    if (arg.startsWith("--initial-js-total=")) {
      out.initialJsTotal = parseCliBudget(arg.slice("--initial-js-total=".length), out.initialJsTotal);
      continue;
    }
    if (arg.startsWith("--image-total=")) {
      out.imageTotal = parseCliBudget(arg.slice("--image-total=".length), out.imageTotal);
      continue;
    }
    if (arg.startsWith("--largest-image=")) {
      out.largestImage = parseCliBudget(arg.slice("--largest-image=".length), out.largestImage);
    }
  }
  return out;
}

const assets = listAssets();
const jsAssets = assets.filter((a) => a.ext === ".js");
const imageAssets = assets.filter((a) => imageExts.has(a.ext));
const manifest = loadManifest();
const initialJsNames = collectInitialJsAssetNames(manifest);
const initialJsAssets = initialJsNames
  ? jsAssets.filter((a) => initialJsNames.has(a.name))
  : jsAssets;
const cli = parseCliArgs(process.argv.slice(2));

const totalJsBytes = jsAssets.reduce((sum, a) => sum + a.bytes, 0);
const initialJsBytes = initialJsAssets.reduce((sum, a) => sum + a.bytes, 0);
const totalImageBytes = imageAssets.reduce((sum, a) => sum + a.bytes, 0);
const largestJs = jsAssets.slice().sort((a, b) => b.bytes - a.bytes)[0] || null;
const largestImage = imageAssets.slice().sort((a, b) => b.bytes - a.bytes)[0] || null;

console.log("PERF_REPORT");
console.log(`generated_at=${new Date().toISOString()}`);
console.log(`assets_dir=${assetsDir}`);
console.log(`js_total_bytes=${totalJsBytes}`);
console.log(`js_total_human=${formatBytes(totalJsBytes)}`);
console.log(`initial_js_bytes=${initialJsBytes}`);
console.log(`initial_js_human=${formatBytes(initialJsBytes)}`);
console.log(`image_total_bytes=${totalImageBytes}`);
console.log(`image_total_human=${formatBytes(totalImageBytes)}`);
console.log(`largest_js_name=${largestJs ? largestJs.name : "none"}`);
console.log(`largest_js_bytes=${largestJs ? largestJs.bytes : 0}`);
console.log(`largest_image_name=${largestImage ? largestImage.name : "none"}`);
console.log(`largest_image_bytes=${largestImage ? largestImage.bytes : 0}`);
console.log("");

printTop("top_js_chunks", jsAssets, 10);
console.log("");
printTop("top_initial_js_chunks", initialJsAssets, 10);
console.log("");
printTop("top_image_assets", imageAssets, 10);

const enforceBudget = process.env.PERF_BUDGET_ENFORCE === "1";
const totalJsBudget = parseBudget("PERF_BUDGET_JS_TOTAL_BYTES", cli.jsTotal);
const initialJsBudget = parseBudget("PERF_BUDGET_INITIAL_JS_TOTAL_BYTES", cli.initialJsTotal);
const largestJsBudget = parseBudget("PERF_BUDGET_LARGEST_JS_BYTES", cli.largestJs);
const totalImageBudget = parseBudget("PERF_BUDGET_IMAGE_TOTAL_BYTES", cli.imageTotal);
const largestImageBudget = parseBudget("PERF_BUDGET_LARGEST_IMAGE_BYTES", cli.largestImage);
const shouldCheck = cli.enforce
  || enforceBudget
  || totalJsBudget != null
  || initialJsBudget != null
  || largestJsBudget != null
  || totalImageBudget != null
  || largestImageBudget != null;

if (shouldCheck) {
  let failed = false;
  if (totalJsBudget != null && totalJsBytes > totalJsBudget) {
    failed = true;
    console.error(
      `PERF_BUDGET_FAIL js_total_bytes=${totalJsBytes} exceeds ${totalJsBudget}`
    );
  }
  if (largestJsBudget != null && (largestJs?.bytes || 0) > largestJsBudget) {
    failed = true;
    console.error(
      `PERF_BUDGET_FAIL largest_js_bytes=${largestJs?.bytes || 0} exceeds ${largestJsBudget}`
    );
  }
  if (initialJsBudget != null && initialJsBytes > initialJsBudget) {
    failed = true;
    console.error(
      `PERF_BUDGET_FAIL initial_js_bytes=${initialJsBytes} exceeds ${initialJsBudget}`
    );
  }
  if (totalImageBudget != null && totalImageBytes > totalImageBudget) {
    failed = true;
    console.error(
      `PERF_BUDGET_FAIL image_total_bytes=${totalImageBytes} exceeds ${totalImageBudget}`
    );
  }
  if (largestImageBudget != null && (largestImage?.bytes || 0) > largestImageBudget) {
    failed = true;
    console.error(
      `PERF_BUDGET_FAIL largest_image_bytes=${largestImage?.bytes || 0} exceeds ${largestImageBudget}`
    );
  }
  if (!failed) {
    console.log("PERF_BUDGET_OK");
  }
  if (failed) process.exit(2);
}
