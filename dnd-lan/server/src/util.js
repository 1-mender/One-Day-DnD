import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const now = () => Date.now();
export const jsonParse = (s, fallback) => {
  try { return JSON.parse(s); } catch { return fallback; }
};
export const ensureDir = (p) => fs.mkdirSync(p, { recursive: true });

export const randId = (len = 16) => {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let out = "";
  for (let i = 0; i < len; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
};

export const copyClientDistToServerPublic = () => {
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const repoRoot = path.resolve(__dirname, "..", "..");
  const srcDir = path.join(repoRoot, "client", "dist");
  const dstDir = path.join(repoRoot, "server", "public");

  if (!fs.existsSync(srcDir)) {
    console.error("client/dist not found. Run: npm --prefix client run build");
    process.exit(1);
  }
  fs.rmSync(dstDir, { recursive: true, force: true });
  fs.mkdirSync(dstDir, { recursive: true });

  const copyRecursive = (from, to) => {
    for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
      const f = path.join(from, entry.name);
      const t = path.join(to, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(t, { recursive: true });
        copyRecursive(f, t);
      } else {
        fs.copyFileSync(f, t);
      }
    }
  };
  copyRecursive(srcDir, dstDir);
  console.log("Copied client/dist -> server/public");
};

if (process.argv[2] === "copy-client") {
  copyClientDistToServerPublic();
}
