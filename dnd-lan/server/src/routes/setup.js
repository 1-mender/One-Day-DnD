import express from "express";
import { dbHasDm } from "../db.js";
import { createDmUser } from "../auth.js";

export const setupRouter = express.Router();

setupRouter.post("/setup", (req, res) => {
  if (dbHasDm()) return res.status(409).json({ error: "already_setup" });
  const { username, password } = req.body || {};
  if (!username || !password || String(password).length < 6) {
    return res.status(400).json({ error: "invalid_input", hint: "password>=6" });
  }
  const user = createDmUser(String(username), String(password));
  return res.json({ ok: true, user });
});
