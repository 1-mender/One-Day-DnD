import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";

import { closeDb, getDb, initDb } from "./db.js";
import { ensureUploads } from "./uploads.js";
import { createSocketServer } from "./sockets.js";
import { now } from "./util.js";
import { uploadsDir, publicDir } from "./paths.js";
import { registerHealthRoutes } from "./health.js";

import { serverInfoRouter } from "./routes/serverInfo.js";
import { setupRouter } from "./routes/setup.js";
import { authRouter } from "./routes/auth.js";
import { partyRouter } from "./routes/party.js";
import { playersRouter } from "./routes/players.js";
import { inventoryRouter } from "./routes/inventory.js";
import { bestiaryRouter } from "./routes/bestiary.js";
import { bestiaryPortabilityRouter } from "./routes/bestiaryPortability.js";
import { eventsRouter } from "./routes/events.js";
import { infoBlocksRouter } from "./routes/infoBlocks.js";
import { backupRouter } from "./routes/backup.js";
import { bestiaryImagesRouter } from "./routes/bestiaryImages.js";
import { infoUploadsRouter } from "./routes/infoUploads.js";
import { profileRouter } from "./routes/profile.js";
import { ticketsRouter } from "./routes/tickets.js";

const PORT = Number(process.env.PORT || 3000);

initDb();
ensureUploads();

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan("dev"));
app.use(cookieParser());
app.use(express.json({ limit: "2mb" }));
registerHealthRoutes(app, { getDb, uploadsDir });

// DEV: allow Vite dev server with credentials
app.use((req, res, next) => {
  const origin = req.headers.origin;
  if (origin && process.env.NODE_ENV !== "production") {
    let allow = false;
    try {
      const u = new URL(origin);
      if ((u.protocol === "http:" || u.protocol === "https:") && u.port === "5173") {
        allow = true;
      }
    } catch {}
    if (!allow) {
      allow = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[0-1])\.\d{1,3}\.\d{1,3}):5173$/.test(origin);
    }
    if (allow) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Access-Control-Allow-Credentials", "true");
      res.setHeader("Access-Control-Allow-Headers", "content-type, x-player-token");
      res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS");
      if (req.method === "OPTIONS") return res.sendStatus(204);
    }
  }
  next();
});

// Static uploads
app.use("/uploads", express.static(uploadsDir));

// API routes
app.use("/api/server", serverInfoRouter);
app.use("/api/dm", setupRouter);
app.use("/api/auth", authRouter);
app.use("/api/party", partyRouter);
app.use("/api/players", playersRouter);
app.use("/api/inventory", inventoryRouter);
app.use("/api/bestiary", bestiaryImagesRouter);
app.use("/api/bestiary", bestiaryPortabilityRouter);
app.use("/api/bestiary", bestiaryRouter);
app.use("/api/info-blocks", infoUploadsRouter);
app.use("/api/info-blocks", infoBlocksRouter);
app.use("/api/backup", backupRouter);
app.use("/api/events", eventsRouter);
app.use("/api", profileRouter);
app.use("/api/tickets", ticketsRouter);

// Serve built client (prod)
if (fs.existsSync(publicDir)) {
  app.use(express.static(publicDir));
  app.get("*", (req, res) => {
    res.sendFile(path.join(publicDir, "index.html"));
  });
}

// Error handler (JSON-only API)
app.use((err, _req, res, _next) => {
  if (!err) return res.status(500).json({ error: "server_error" });
  if (err.type === "entity.too.large") return res.status(413).json({ error: "payload_too_large" });
  if (err instanceof SyntaxError && err.status === 400) return res.status(400).json({ error: "invalid_json" });
  const status = Number(err.status || err.statusCode) || 500;
  const code = err.code && typeof err.code === "string" ? err.code : "server_error";
  console.error("request error:", err);
  return res.status(status).json({ error: code });
});

const httpServer = http.createServer(app);
const io = createSocketServer(httpServer);
app.locals.io = io;

const IDLE_AFTER_MS = Number(process.env.IDLE_AFTER_MS || 5 * 60 * 1000);
const SWEEP_EVERY_MS = 15_000;

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
    console.error("idle sweep failed:", e);
  }
}, SWEEP_EVERY_MS);

const CLEANUP_EVERY_MS = Number(process.env.CLEANUP_EVERY_MS || 5 * 60 * 1000);
const JOIN_REQUEST_TTL_MS = Number(process.env.JOIN_REQUEST_TTL_MS || 24 * 60 * 60 * 1000);
const TRANSFER_CLEANUP_EVERY_MS = Number(process.env.TRANSFER_CLEANUP_EVERY_MS || CLEANUP_EVERY_MS || 5 * 60 * 1000);

function cleanupExpiredTransfers() {
  const db = getDb();
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

if (TRANSFER_CLEANUP_EVERY_MS > 0) {
  const cleanupInterval = setInterval(() => {
    try {
      const db = getDb();
      const t = now();

      db.prepare("DELETE FROM sessions WHERE revoked=1 OR expires_at<?").run(t);

      if (JOIN_REQUEST_TTL_MS > 0) {
        const cutoff = t - JOIN_REQUEST_TTL_MS;
        db.prepare("DELETE FROM join_requests WHERE created_at<?").run(cutoff);
      }

      cleanupExpiredTransfers();
    } catch (e) {
      console.error("cleanup failed:", e);
    }
  }, TRANSFER_CLEANUP_EVERY_MS);

  app.locals.cleanupInterval = cleanupInterval;
}

httpServer.listen(PORT, "0.0.0.0", () => {
  console.log(`LAN server listening on 0.0.0.0:${PORT}`);
  console.log(`DM: http://localhost:${PORT}/dm`);
});

let shuttingDown = false;
const SHUTDOWN_TIMEOUT_MS = Number(process.env.SHUTDOWN_TIMEOUT_MS || 10_000);

function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`Received ${signal}, shutting down...`);

  clearInterval(idleSweepInterval);
  if (app.locals.cleanupInterval) clearInterval(app.locals.cleanupInterval);

  const forceExitTimer = setTimeout(() => {
    console.error("Forced shutdown after timeout");
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  io.close(() => {
    httpServer.close(() => {
      clearTimeout(forceExitTimer);
      try {
        closeDb();
      } catch (error) {
        console.error("Failed to close DB:", error);
      }
      process.exit(0);
    });
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
