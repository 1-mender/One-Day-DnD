import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";

const root = process.cwd();
const uiDir = path.join(root, "client", "src", "assets", "ui");

if (!fs.existsSync(uiDir)) {
  console.error(`ui assets folder not found: ${uiDir}`);
  process.exit(1);
}

const files = fs.readdirSync(uiDir).filter((f) => f.toLowerCase().endsWith(".png"));
if (!files.length) {
  console.log("No PNG files found to optimize.");
  process.exit(0);
}

function newerThan(src, outPath) {
  if (!fs.existsSync(outPath)) return true;
  const srcTime = fs.statSync(src).mtimeMs;
  const outTime = fs.statSync(outPath).mtimeMs;
  return srcTime > outTime;
}

async function run() {
  let count = 0;
  for (const file of files) {
    const input = path.join(uiDir, file);
    const base = file.slice(0, -4);
    const outWebp = path.join(uiDir, `${base}.webp`);
    const outAvif = path.join(uiDir, `${base}.avif`);

    if (newerThan(input, outWebp)) {
      await sharp(input).webp({ quality: 82 }).toFile(outWebp);
      count += 1;
    }
    if (newerThan(input, outAvif)) {
      await sharp(input).avif({ quality: 55 }).toFile(outAvif);
      count += 1;
    }
  }
  console.log(`Optimized assets: ${count} outputs`);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
