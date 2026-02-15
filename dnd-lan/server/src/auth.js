import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { getDb, DATA_DIR } from "./db.js";
import { now } from "./util.js";

let cachedSecret;

export function getJwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (cachedSecret) return cachedSecret;
  const secretPath = path.join(DATA_DIR, ".jwt_secret");
  try {
    cachedSecret = fs.readFileSync(secretPath, "utf8").trim();
  } catch {
    // ignore read error
  }
  if (!cachedSecret) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    cachedSecret = crypto.randomBytes(32).toString("hex");
    fs.writeFileSync(secretPath, cachedSecret, { mode: 0o600 });
  }
  return cachedSecret;
}

export function getDmCookieName() {
  return process.env.DM_COOKIE || "dm_token";
}

export function signDmToken(user) {
  const tokenVersion = Number(user?.token_version || 0);
  return jwt.sign({ uid: user.id, u: user.username, role: "dm", tv: tokenVersion }, getJwtSecret(), { expiresIn: "30d" });
}

export function verifyDmToken(token) {
  const payload = jwt.verify(token, getJwtSecret());
  const user = getDb().prepare("SELECT id, token_version FROM users WHERE id=?").get(Number(payload?.uid || 0));
  if (!user) {
    throw new Error("dm_user_not_found");
  }
  if (Number(user.token_version || 0) !== Number(payload?.tv || 0)) {
    throw new Error("dm_token_revoked");
  }
  return payload;
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
  return getDb().prepare("SELECT id, username, must_change_password, token_version FROM users WHERE id=?").get(info.lastInsertRowid);
}

export function loginDm(username, password) {
  const row = getDb().prepare("SELECT * FROM users WHERE username=?").get(username);
  if (!row) return null;
  const ok = bcrypt.compareSync(password, row.password_hash);
  if (!ok) return null;
  return {
    id: row.id,
    username: row.username,
    must_change_password: row.must_change_password,
    token_version: Number(row.token_version || 0)
  };
}

export function changeDmPassword(userId, newPassword) {
  const hash = bcrypt.hashSync(newPassword, 10);
  getDb().prepare("UPDATE users SET password_hash=?, must_change_password=0, token_version=token_version+1 WHERE id=?")
    .run(hash, userId);
  return getDb().prepare("SELECT id, username, must_change_password, token_version FROM users WHERE id=?").get(userId);
}
