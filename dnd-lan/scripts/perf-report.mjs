import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
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

const assets = listAssets();
const jsAssets = assets.filter((a) => a.ext === ".js");
const imageAssets = assets.filter((a) => imageExts.has(a.ext));

const totalJsBytes = jsAssets.reduce((sum, a) => sum + a.bytes, 0);
const totalImageBytes = imageAssets.reduce((sum, a) => sum + a.bytes, 0);
const largestJs = jsAssets.slice().sort((a, b) => b.bytes - a.bytes)[0] || null;
const largestImage = imageAssets.slice().sort((a, b) => b.bytes - a.bytes)[0] || null;

console.log("PERF_REPORT");
console.log(`generated_at=${new Date().toISOString()}`);
console.log(`assets_dir=${assetsDir}`);
console.log(`js_total_bytes=${totalJsBytes}`);
console.log(`js_total_human=${formatBytes(totalJsBytes)}`);
console.log(`image_total_bytes=${totalImageBytes}`);
console.log(`image_total_human=${formatBytes(totalImageBytes)}`);
console.log(`largest_js_name=${largestJs ? largestJs.name : "none"}`);
console.log(`largest_js_bytes=${largestJs ? largestJs.bytes : 0}`);
console.log(`largest_image_name=${largestImage ? largestImage.name : "none"}`);
console.log(`largest_image_bytes=${largestImage ? largestImage.bytes : 0}`);
console.log("");

printTop("top_js_chunks", jsAssets, 10);
console.log("");
printTop("top_image_assets", imageAssets, 10);
