import crypto from "node:crypto";
import pino from "pino";
import pinoHttp from "pino-http";

export const logger = pino({
  level: process.env.LOG_LEVEL || "info",
  base: { service: "dnd-lan" },
  redact: {
    paths: [
      "req.headers.cookie",
      "req.headers.authorization",
      "req.headers.x-player-token"
    ],
    remove: true
  }
});

function genReqId(req, res) {
  const incoming = req.headers["x-request-id"];
  const id = typeof incoming === "string" && incoming.trim()
    ? incoming.trim()
    : crypto.randomUUID();
  res.setHeader("x-request-id", id);
  return id;
}

export const httpLogger = pinoHttp({
  logger,
  genReqId,
  customProps: (req) => ({ requestId: req.id })
});
