import express from "express";
import { getDmCookieName, loginDm, signDmToken, changeDmPassword, verifyDmToken } from "../auth.js";
import { dbHasDm, getDb } from "../db.js";
import { dmAuthMiddleware } from "../auth.js";

export const authRouter = express.Router();

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

authRouter.post("/login", (req, res) => {
  if (!dbHasDm()) return res.status(409).json({ error: "needs_setup" });
  const { username, password } = req.body || {};
  const user = loginDm(String(username || ""), String(password || ""));
  if (!user) return res.status(401).json({ error: "bad_credentials" });
  const token = signDmToken(user);
  res.cookie(getDmCookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: false
  });
  return res.json({ ok: true, user: { username: user.username, mustChangePassword: !!user.must_change_password } });
});

authRouter.post("/logout", (req, res) => {
  res.clearCookie(getDmCookieName());
  res.json({ ok: true });
});

authRouter.post("/change-password", dmAuthMiddleware, (req, res) => {
  const { newPassword } = req.body || {};
  if (!newPassword || String(newPassword).length < 6) return res.status(400).json({ error: "invalid_input" });
  changeDmPassword(req.dm.uid, String(newPassword));
  res.json({ ok: true });
});
