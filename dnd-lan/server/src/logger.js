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

const URL_SECRET_QUERY_PARAMS = new Set([
  "token",
  "playertoken",
  "proof",
  "clientproof"
]);

export function sanitizeReqUrl(rawUrl) {
  const value = String(rawUrl || "");
  if (!value) return value;
  try {
    const parsed = new URL(value, "http://127.0.0.1");
    for (const key of Array.from(parsed.searchParams.keys())) {
      if (URL_SECRET_QUERY_PARAMS.has(String(key || "").toLowerCase())) {
        parsed.searchParams.set(key, "[Redacted]");
      }
    }
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return value;
  }
}

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
  customProps: (req) => ({ requestId: req.id }),
  serializers: {
    req(req) {
      const out = pino.stdSerializers.req(req);
      out.url = sanitizeReqUrl(out.url);
      return out;
    }
  }
});
