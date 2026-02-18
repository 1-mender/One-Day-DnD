import express from "express";
import { dbHasDm } from "../db.js";
import { createDmUser } from "../auth.js";
import { normalizeIp } from "../util.js";

export const setupRouter = express.Router();

const TRUSTED_SETUP_IPS = new Set(
  String(process.env.DM_SETUP_TRUSTED_IPS || "")
    .split(",")
    .map((ip) => normalizeIp(ip))
    .filter(Boolean)
);

function requestIps(req) {
  const out = new Set();
  const primary = normalizeIp(req.ip);
  if (primary) out.add(primary);
  return out;
}

function isLoopback(ip) {
  return ip === "127.0.0.1" || ip === "::1";
}

function isTrustedSetupRequest(req) {
  const ips = requestIps(req);
  for (const ip of ips) {
    if (isLoopback(ip) || TRUSTED_SETUP_IPS.has(ip)) return true;
  }
  return false;
}

setupRouter.post("/setup", (req, res) => {
  if (dbHasDm()) return res.status(409).json({ error: "already_setup" });

  const expectedSecret = String(process.env.DM_SETUP_SECRET || "").trim();
  const providedSecret = String(req.header("x-setup-secret") || req.body?.setupSecret || "").trim();
  if (expectedSecret) {
    if (providedSecret !== expectedSecret) {
      return res.status(403).json({ error: "setup_secret_required" });
    }
  } else if (!isTrustedSetupRequest(req)) {
    return res.status(403).json({ error: "setup_local_only" });
  }

  const { username, password } = req.body || {};
  if (!username || !password || String(password).length < 6) {
    return res.status(400).json({ error: "invalid_input", hint: "password>=6" });
  }
  const user = createDmUser(String(username), String(password));
  return res.json({ ok: true, user });
});
