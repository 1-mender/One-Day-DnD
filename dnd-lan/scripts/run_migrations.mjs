import { initDb } from "../server/src/db.js";

(async () => {
  try {
    console.log("Running initDb (will apply migrations if any)...");
    initDb();
    console.log("initDb completed");
    process.exit(0);
  } catch (err) {
    console.error("initDb failed:", err);
    process.exit(1);
  }
})();
