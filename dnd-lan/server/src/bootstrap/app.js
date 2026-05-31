import express from "express";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
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
import { liveActivityRouter } from "../routes/liveActivity.js";
import { mapRouter } from "../routes/map.js";
import { partyRouter } from "../routes/party.js";
import { playersRouter } from "../routes/players.js";
import { profileRouter } from "../routes/profile.js";
import { serverInfoRouter } from "../routes/serverInfo.js";
import { setupRouter } from "../routes/setup.js";
import { ticketsRouter } from "../routes/tickets.js";

const CSP_DISABLED = String(process.env.CSP_DISABLED || "0") === "1";
const secureCookie = process.env.NODE_ENV === "production";
const CSRF_COOKIE_NAME = process.env.CSRF_COOKIE || "csrf_token";
const CSRF_COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookie,
  path: "/"
};
const CSRF_TOKEN_RE = /^[a-f0-9]{64}$/i;

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
  // Указываем путь к общему корню всех мини-игр
const minigamesDir = path.resolve(publicDir, "..", "..", "..", "Mini-game");

// Раздаем статическую папку под общим префиксом /minigames
app.use('/minigames', express.static(minigamesDir));
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
        res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Player-Token, X-CSRF-Token");
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
  if (fs.existsSync(minigamesDir)) {
    const allowShieldIframe = (_req, res, next) => {
      res.removeHeader("Content-Security-Policy");
      res.removeHeader("X-Frame-Options");
      res.removeHeader("Cross-Origin-Opener-Policy");
      res.removeHeader("Cross-Origin-Embedder-Policy");
      res.removeHeader("Cross-Origin-Resource-Policy");
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
      res.setHeader("Pragma", "no-cache");
      res.setHeader("Expires", "0");
      return next();
    };

    app.get(/^\/mini-game\/shield$/, (_req, res) => {
      res.redirect(302, "/mini-game/shield/");
    });
    app.use("/minigames", allowShieldIframe, express.static(minigamesDir));
  }

  app.use(assertWritable);

  function readCsrfCookieToken(req) {
    const token = String(req.cookies?.[CSRF_COOKIE_NAME] || "");
    return CSRF_TOKEN_RE.test(token) ? token : "";
  }

  function verifyCsrfToken(req, res, next) {
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return next();
    const token = Array.isArray(req.headers["x-csrf-token"])
      ? String(req.headers["x-csrf-token"][0] || "")
      : String(req.headers["x-csrf-token"] || (req.body && req.body._csrf) || "");
    const cookieToken = readCsrfCookieToken(req);
    if (!token || !cookieToken) {
      return res.status(403).json({ error: "csrf_token_missing" });
    }
    if (!CSRF_TOKEN_RE.test(token) || token !== cookieToken) {
      return res.status(403).json({ error: "csrf_token_mismatch" });
    }
    return next();
  }

  function generateCsrfToken(req, res, next) {
    const token = readCsrfCookieToken(req) || crypto.randomBytes(32).toString("hex");
    if (token !== readCsrfCookieToken(req)) {
      res.cookie(CSRF_COOKIE_NAME, token, CSRF_COOKIE_OPTS);
    }
    res.locals.csrfToken = token;
    return next();
  }

  app.use("/api/auth", authRouter);
  app.use("/api/dm", verifyCsrfToken, setupRouter);
  app.use("/api/party", verifyCsrfToken, partyRouter);
  app.use("/api/players", verifyCsrfToken, playersRouter);
  app.use("/api/live-activity", verifyCsrfToken, liveActivityRouter);
  app.use("/api/map", verifyCsrfToken, mapRouter);
  app.use("/api/inventory", verifyCsrfToken, inventoryRouter);
  app.use("/api/bestiary", verifyCsrfToken, bestiaryImagesRouter);
  app.use("/api/bestiary", verifyCsrfToken, bestiaryPortabilityRouter);
  app.use("/api/bestiary", verifyCsrfToken, bestiaryRouter);
  app.use("/api/info-blocks", verifyCsrfToken, infoUploadsRouter);
  app.use("/api/info-blocks", verifyCsrfToken, infoBlocksRouter);
  app.use("/api/backup", verifyCsrfToken, backupRouter);
  app.use("/api/events", verifyCsrfToken, eventsRouter);
  app.use("/api", verifyCsrfToken, profileRouter);
  app.use("/api/tickets", verifyCsrfToken, ticketsRouter);
  app.get("/api/csrf-token", generateCsrfToken, (req, res) => {
    res.json({ csrfToken: res.locals.csrfToken });
  });

  app.use("/api/server", serverInfoRouter);

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
