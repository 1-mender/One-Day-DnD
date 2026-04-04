import express from "express";
import fs from "node:fs";
import path from "node:path";
import cookieParser from "cookie-parser";
import helmet from "helmet";

import { httpLogger } from "../logger.js";
import { publicDir, uploadsDir } from "../paths.js";
import { createRuntimeMetricsMiddleware } from "../runtimeMetrics.js";
import { assertWritable } from "../writeGate.js";
import { authRouter } from "../routes/auth.js";
import { backupRouter } from "../routes/backup.js";
import { bestiaryRouter } from "../routes/bestiary.js";
import { bestiaryImagesRouter } from "../routes/bestiaryImages.js";
import { bestiaryPortabilityRouter } from "../routes/bestiaryPortability.js";
import { eventsRouter } from "../routes/events.js";
import { infoBlocksRouter } from "../routes/infoBlocks.js";
import { infoUploadsRouter } from "../routes/infoUploads.js";
import { inventoryRouter } from "../routes/inventory.js";
import { partyRouter } from "../routes/party.js";
import { playersRouter } from "../routes/players.js";
import { profileRouter } from "../routes/profile.js";
import { serverInfoRouter } from "../routes/serverInfo.js";
import { setupRouter } from "../routes/setup.js";
import { ticketsRouter } from "../routes/tickets.js";

const CSP_DISABLED = String(process.env.CSP_DISABLED || "0") === "1";

function buildCspDirectives() {
  const allowUnsafeEval = String(process.env.CSP_ALLOW_UNSAFE_EVAL || "0") === "1";
  const directives = {
    defaultSrc: ["'self'"],
    baseUri: ["'self'"],
    objectSrc: ["'none'"],
    frameAncestors: ["'none'"],
    scriptSrc: allowUnsafeEval ? ["'self'", "'unsafe-eval'"] : ["'self'"],
    styleSrc: ["'self'", "'unsafe-inline'"],
    imgSrc: ["'self'", "data:", "blob:"],
    fontSrc: ["'self'", "data:"],
    connectSrc: ["'self'", "ws:", "wss:"],
    formAction: ["'self'"],
    manifestSrc: ["'self'"]
  };
  directives.upgradeInsecureRequests =
    String(process.env.CSP_UPGRADE_INSECURE_REQUESTS || "0") === "1" ? [] : null;
  return directives;
}

export function createApp() {
  const app = express();
  app.use(helmet({
    contentSecurityPolicy: CSP_DISABLED
      ? false
      : { directives: buildCspDirectives() }
  }));
  app.use(httpLogger);
  app.use(createRuntimeMetricsMiddleware());
  app.use(cookieParser());
  app.use(express.json({ limit: "2mb" }));

  if (process.env.NODE_ENV !== "production") {
    const allowedOrigins = (process.env.DEV_ALLOWED_ORIGINS || "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean);

    const isAllowedOrigin = (origin) => {
      if (!origin) return true;
      if (allowedOrigins.length === 0) return true;
      return allowedOrigins.includes(origin);
    };

    app.use((req, res, next) => {
      const origin = req.headers.origin;
      if (isAllowedOrigin(origin)) {
        if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
        else res.setHeader("Access-Control-Allow-Origin", "*");
        res.setHeader("Vary", "Origin");
        res.setHeader("Access-Control-Allow-Credentials", "true");
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Player-Token");
        res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
      }
      if (req.method === "OPTIONS") return res.sendStatus(204);
      return next();
    });
  }

  const blockedUploadExtensions = new Set([".html", ".htm", ".xhtml", ".svg", ".js", ".mjs", ".cjs"]);
  const imageUploadExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
  app.use("/uploads", (req, res, next) => {
    const ext = path.extname(String(req.path || "")).toLowerCase();
    if (ext && blockedUploadExtensions.has(ext)) return res.sendStatus(404);
    return next();
  });
  app.use("/uploads", express.static(uploadsDir, {
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      res.setHeader("X-Content-Type-Options", "nosniff");
      if (!imageUploadExtensions.has(ext)) {
        res.setHeader("Content-Disposition", `attachment; filename="${path.basename(filePath)}"`);
      }
    }
  }));

  app.use(assertWritable);
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

  return app;
}

export function finalizeApp(app) {
  if (fs.existsSync(publicDir)) {
    app.use(express.static(publicDir));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(publicDir, "index.html"));
    });
  }

  app.use((err, req, res, _next) => {
    if (!err) return res.status(500).json({ error: "server_error" });
    if (err.type === "entity.too.large") return res.status(413).json({ error: "payload_too_large" });
    if (err instanceof SyntaxError && err.status === 400) return res.status(400).json({ error: "invalid_json" });
    const status = Number(err.status || err.statusCode) || 500;
    const code = err.code && typeof err.code === "string" ? err.code : "server_error";
    req?.log?.error({ err }, "request error");
    return res.status(status).json({ error: code });
  });

  return app;
}
