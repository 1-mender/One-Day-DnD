import express from "express";
import rateLimit from "express-rate-limit";
import { getDmCookieName, loginDm, signDmToken, changeDmPassword, verifyDmToken } from "../auth.js";
import { dbHasDm, getDb } from "../db.js";
import { dmAuthMiddleware } from "../auth.js";
import { getActiveSessionByToken, getPlayerBySession, getPlayerCookieName, getPlayerTokenFromRequest } from "../sessionAuth.js";

export const authRouter = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.DM_LOGIN_MAX_ATTEMPTS || 20),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: "rate_limited" })
});

const secureCookie = process.env.NODE_ENV === "production";
const dmCookieOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookie
};
const playerCookieBaseOpts = {
  httpOnly: true,
  sameSite: "lax",
  secure: secureCookie,
  path: "/"
};

authRouter.get("/me", (req, res) => {
  if (!dbHasDm()) return res.json({ needsSetup: true });
  const token = req.cookies?.[getDmCookieName()];
  if (!token) return res.json({ authenticated: false });
  try {
    verifyDmToken(token);
    return res.json({ authenticated: true });
  } catch {
    return res.json({ authenticated: false });
  }
});

authRouter.post("/login", loginLimiter, (req, res) => {
  if (!dbHasDm()) return res.status(409).json({ error: "needs_setup" });
  const { username, password } = req.body || {};
  const user = loginDm(String(username || ""), String(password || ""));
  if (!user) return res.status(401).json({ error: "bad_credentials" });
  const token = signDmToken(user);
  res.cookie(getDmCookieName(), token, dmCookieOpts);
  return res.json({ ok: true, user: { username: user.username, mustChangePassword: !!user.must_change_password } });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(getDmCookieName(), dmCookieOpts);
  res.json({ ok: true });
});

authRouter.post("/change-password", dmAuthMiddleware, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: "invalid_input" });
  const user = changeDmPassword(req.dm.uid, String(newPassword));
  const token = signDmToken(user);
  res.cookie(getDmCookieName(), token, dmCookieOpts);
  res.json({ ok: true });
});

authRouter.post("/player/session", (req, res) => {
  const token = String(req.body?.playerToken || "");
  if (!token) return res.status(400).json({ error: "player_token_required" });

  const sess = getActiveSessionByToken(token, { at: Date.now() });
  if (!sess) return res.status(401).json({ error: "session_invalid" });
  const player = getPlayerBySession(sess);
  if (!player) return res.status(401).json({ error: "session_invalid" });

  const expiresAt = Number(sess.expires_at || 0);
  const maxAge = Math.max(0, expiresAt - Date.now());
  res.cookie(getPlayerCookieName(), token, { ...playerCookieBaseOpts, maxAge });
  res.json({
    ok: true,
    playerId: Number(sess.player_id),
    partyId: Number(sess.party_id),
    expiresAt
  });
});

authRouter.post("/player/logout", (req, res) => {
  const db = getDb();
  const token = getPlayerTokenFromRequest(req);
  if (token) {
    db.prepare("UPDATE sessions SET revoked=1 WHERE token=?").run(token);
  }
  res.clearCookie(getPlayerCookieName(), playerCookieBaseOpts);
  res.json({ ok: true });
});
