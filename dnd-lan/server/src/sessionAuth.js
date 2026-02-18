import cookie from "cookie";
import { getDmCookieName, verifyDmToken } from "./auth.js";
import { getDb } from "./db.js";
import { now } from "./util.js";

export function getPlayerTokenFromRequest(req) {
  const token = req?.header?.("x-player-token");
  if (!token) return "";
  return String(token);
}

export function getActiveSessionByToken(token, { db = getDb(), at = now() } = {}) {
  const normalized = String(token || "");
  if (!normalized) return null;
  return db.prepare("SELECT * FROM sessions WHERE token=? AND revoked=0 AND expires_at>?").get(normalized, at) || null;
}

export function getPlayerBySession(session, { db = getDb(), allowBanned = false } = {}) {
  const playerId = Number(session?.player_id || 0);
  if (!playerId) return null;
  if (allowBanned) {
    return db.prepare("SELECT * FROM players WHERE id=?").get(playerId) || null;
  }
  return db.prepare("SELECT * FROM players WHERE id=? AND banned=0").get(playerId) || null;
}

export function getPlayerContextByToken(token, options = {}) {
  const sess = getActiveSessionByToken(token, options);
  if (!sess) return null;
  const player = getPlayerBySession(sess, options);
  if (!player) return null;
  return { sess, player };
}

export function getPlayerContextFromRequest(req, options = {}) {
  const token = getPlayerTokenFromRequest(req);
  if (!token) return null;
  return getPlayerContextByToken(token, options);
}

export function getDmPayloadFromToken(token) {
  const normalized = String(token || "");
  if (!normalized) return null;
  try {
    return verifyDmToken(normalized);
  } catch {
    return null;
  }
}

export function getDmPayloadFromRequest(req) {
  const token = req?.cookies?.[getDmCookieName()];
  return getDmPayloadFromToken(token);
}

export function isDmRequest(req) {
  return !!getDmPayloadFromRequest(req);
}

export function getDmPayloadFromSocketRequest(socketRequest) {
  const rawCookie = socketRequest?.headers?.cookie || "";
  if (!rawCookie) return null;
  const parsed = cookie.parse(rawCookie);
  const token = parsed[getDmCookieName()];
  return getDmPayloadFromToken(token);
}

export function getDmAuthFromSocketRequest(socketRequest) {
  const rawCookie = socketRequest?.headers?.cookie || "";
  if (!rawCookie) return { hasToken: false, payload: null };
  const parsed = cookie.parse(rawCookie);
  const token = parsed[getDmCookieName()];
  if (!token) return { hasToken: false, payload: null };
  return { hasToken: true, payload: getDmPayloadFromToken(token) };
}
