import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const TEXT_EXTENSIONS = new Set([
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx",
  ".json", ".md", ".css", ".html", ".sql",
  ".yml", ".yaml", ".txt", ".env", ".ini"
]);
const IGNORE_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "coverage"
]);

const utf8Decoder = new TextDecoder("utf-8", { fatal: true });

function shouldCheckFile(fileName) {
  if (fileName.startsWith(".")) {
    // Allow dot-files like .env and .editorconfig.
    const ext = path.extname(fileName).toLowerCase();
    return TEXT_EXTENSIONS.has(ext) || fileName === ".editorconfig";
  }
  const ext = path.extname(fileName).toLowerCase();
  return TEXT_EXTENSIONS.has(ext);
}

async function collectFiles(dir, out = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (IGNORE_DIRS.has(entry.name)) continue;
      await collectFiles(fullPath, out);
      continue;
    }
    if (!entry.isFile()) continue;
    if (!shouldCheckFile(entry.name)) continue;
    out.push(fullPath);
  }
  return out;
}

function hasUtf8Bom(buffer) {
  return buffer.length >= 3
    && buffer[0] === 0xef
    && buffer[1] === 0xbb
    && buffer[2] === 0xbf;
}

async function main() {
  const files = await collectFiles(ROOT);
  const issues = [];

  for (const fullPath of files) {
    const rel = path.relative(ROOT, fullPath).replace(/\\/g, "/");
    const buf = await fs.readFile(fullPath);

    if (hasUtf8Bom(buf)) {
      issues.push(`${rel}: has UTF-8 BOM`);
      continue;
    }

    try {
      utf8Decoder.decode(buf);
    } catch {
      issues.push(`${rel}: invalid UTF-8`);
    }
  }

  if (issues.length) {
    console.error("UTF-8 check failed:");
    for (const issue of issues) {
      console.error(`- ${issue}`);
    }
    process.exit(1);
  }

  console.log(`UTF-8 check passed (${files.length} files).`);
}

main().catch((error) => {
  console.error("UTF-8 check failed with runtime error:", error);
  process.exit(1);
});
