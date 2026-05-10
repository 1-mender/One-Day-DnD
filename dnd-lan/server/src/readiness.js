import fs from "node:fs";

export function checkReadiness({ getDb, uploadsDir }) {
  try {
    const db = getDb();
    db.prepare("SELECT 1 AS ok").get();
    fs.accessSync(uploadsDir, fs.constants.R_OK | fs.constants.W_OK);
    return { ok: true };
  } catch (error) {
    return { ok: false, error };
  }
}
