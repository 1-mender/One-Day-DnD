import fs from "node:fs";
import path from "node:path";

export function ensureUploads() {
  const base = path.resolve("server", "uploads");
  const monsters = path.join(base, "monsters");
  const bestiary = path.join(base, "bestiary");
  const assets = path.join(base, "assets");

  for (const p of [base, monsters, bestiary, assets]) {
    fs.mkdirSync(p, { recursive: true });
  }
}
