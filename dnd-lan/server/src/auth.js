import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "./db.js";
import { now } from "./util.js";

export function getJwtSecret() {
  return process.env.JWT_SECRET || "dev_secret_change_me";
}

export function getDmCookieName() {
  return process.env.DM_COOKIE || "dm_token";
}

export function signDmToken(user) {
  return jwt.sign({ uid: user.id, u: user.username, role: "dm" }, getJwtSecret(), { expiresIn: "30d" });
}

export function verifyDmToken(token) {
  return jwt.verify(token, getJwtSecret());
}

export function dmAuthMiddleware(req, res, next) {
  try {
    const token = req.cookies?.[getDmCookieName()];
    if (!token) return res.status(401).json({ error: "not_authenticated" });
    const payload = verifyDmToken(token);
    req.dm = payload;
    return next();
  } catch {
    return res.status(401).json({ error: "not_authenticated" });
  }
}

export function createDmUser(username, password) {
  const hash = bcrypt.hashSync(password, 10);
  const t = now();
  const info = getDb()
    .prepare("INSERT INTO users(username, password_hash, must_change_password, created_at) VALUES(?,?,?,?)")
    .run(username, hash, 0, t);
  return getDb().prepare("SELECT id, username, must_change_password FROM users WHERE id=?").get(info.lastInsertRowid);
}

export function loginDm(username, password) {
  const row = getDb().prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!row) return null;
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return null;
  return { id: row.id, username: row.username, must_change_password: row.must_change_password };
}

export function changeDmPassword(userId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  getDb().prepare("UPDATE users SET password_hash=?, must_change_password=0 WHERE id=?").run(hash, userId);
}
