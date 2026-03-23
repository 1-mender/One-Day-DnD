import { now } from "../util.js";

const IDLE_AFTER_MS = Number(process.env.IDLE_AFTER_MS || 5 * 60 * 1000);
const SWEEP_EVERY_MS = 15_000;
const CLEANUP_EVERY_MS = Number(process.env.CLEANUP_EVERY_MS || 5 * 60 * 1000);
const JOIN_REQUEST_TTL_MS = Number(process.env.JOIN_REQUEST_TTL_MS || 24 * 60 * 60 * 1000);
const TRANSFER_CLEANUP_EVERY_MS = Number(process.env.TRANSFER_CLEANUP_EVERY_MS || CLEANUP_EVERY_MS || 5 * 60 * 1000);

function cleanupExpiredTransfers(db) {
  const t = now();
  const rows = db
    .prepare("SELECT * FROM item_transfers WHERE status='pending' AND expires_at<=?")
    .all(t);
  if (!rows.length) return;

  const tx = db.transaction(() => {
    for (const tr of rows) {
      const item = db.prepare("SELECT id, reserved_qty FROM inventory_items WHERE id=? AND player_id=?")
        .get(tr.item_id, tr.from_player_id);
      if (item) {
        const reservedQty = Number(item.reserved_qty || 0);
        const nextReserved = Math.max(0, reservedQty - Number(tr.qty || 0));
        db.prepare("UPDATE inventory_items SET reserved_qty=?, updated_at=? WHERE id=?").run(nextReserved, t, item.id);
      }
      db.prepare("UPDATE item_transfers SET status='expired' WHERE id=?").run(tr.id);
    }
  });
  tx();
}

export function startBackgroundJobs({ app, io, getDb, logger }) {
  const idleSweepInterval = setInterval(() => {
    try {
      const db = getDb();
      const t = now();
      const rows = db
        .prepare("SELECT id, party_id, status, last_seen FROM players WHERE banned=0 AND status IN ('online','idle')")
        .all();

      for (const p of rows) {
        const age = t - Number(p.last_seen || 0);

        if (p.status === "online" && age > IDLE_AFTER_MS) {
          db.prepare("UPDATE players SET status='idle' WHERE id=?").run(p.id);
          io.to(`party:${p.party_id}`).emit("player:statusChanged", {
            playerId: p.id,
            status: "idle",
            lastSeen: Number(p.last_seen || t)
          });
        }

        if (p.status === "idle" && age <= IDLE_AFTER_MS) {
          db.prepare("UPDATE players SET status='online' WHERE id=?").run(p.id);
          io.to(`party:${p.party_id}`).emit("player:statusChanged", {
            playerId: p.id,
            status: "online",
            lastSeen: Number(p.last_seen || t)
          });
        }
      }
    } catch (e) {
      logger.error({ err: e }, "idle sweep failed");
    }
  }, SWEEP_EVERY_MS);

  let cleanupInterval = null;
  if (TRANSFER_CLEANUP_EVERY_MS > 0) {
    cleanupInterval = setInterval(() => {
      try {
        const db = getDb();
        const t = now();

        db.prepare("DELETE FROM sessions WHERE revoked=1 OR expires_at<?").run(t);

        if (JOIN_REQUEST_TTL_MS > 0) {
          const cutoff = t - JOIN_REQUEST_TTL_MS;
          db.prepare("DELETE FROM join_requests WHERE created_at<?").run(cutoff);
        }

        cleanupExpiredTransfers(db);
      } catch (e) {
        logger.error({ err: e }, "cleanup failed");
      }
    }, TRANSFER_CLEANUP_EVERY_MS);
    app.locals.cleanupInterval = cleanupInterval;
  }

  return { idleSweepInterval, cleanupInterval };
}
