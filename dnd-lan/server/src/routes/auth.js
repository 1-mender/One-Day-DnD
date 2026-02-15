import express from "express";
import rateLimit from "express-rate-limit";
import { getDmCookieName, loginDm, signDmToken, changeDmPassword, verifyDmToken } from "../auth.js";
import { dbHasDm } from "../db.js";
import { dmAuthMiddleware } from "../auth.js";

export const authRouter = express.Router();

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: Number(process.env.DM_LOGIN_MAX_ATTEMPTS || 20),
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ error: "rate_limited" })
});

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
  const secure = process.env.NODE_ENV === "production";
  res.cookie(getDmCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure
  });
  return res.json({ ok: true, user: { username: user.username, mustChangePassword: !!user.must_change_password } });
});

authRouter.post("/logout", (req, res) => {
  const secure = process.env.NODE_ENV === "production";
  res.clearCookie(getDmCookieName(), {
    httpOnly: true,
    sameSite: "lax",
    secure
  });
  res.json({ ok: true });
});

authRouter.post("/change-password", dmAuthMiddleware, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: "invalid_input" });
  const user = changeDmPassword(req.dm.uid, String(newPassword));
  const token = signDmToken(user);
  const secure = process.env.NODE_ENV === "production";
  res.cookie(getDmCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure
  });
  res.json({ ok: true });
});
