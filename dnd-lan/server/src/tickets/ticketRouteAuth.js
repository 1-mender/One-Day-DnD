import { ensureSessionWritable, getPlayerContextFromRequest } from "../sessionAuth.js";

export function createTicketRouteAuth({ nowFn }) {
  function resolvePlayerContext(req) {
    return getPlayerContextFromRequest(req, { at: nowFn() });
  }

  function requirePlayer(req, res) {
    const me = resolvePlayerContext(req);
    if (!me) {
      res.status(401).json({ error: "not_authenticated" });
      return null;
    }
    return me;
  }

  function requireWritablePlayer(req, res) {
    const me = requirePlayer(req, res);
    if (!me) return null;
    if (!ensureSessionWritable(me.sess, res)) return null;
    return me;
  }

  return {
    resolvePlayerContext,
    requirePlayer,
    requireWritablePlayer
  };
}
