import { getSinglePartyId } from "./db.js";

export function emitSinglePartyEvent(io, event, payload, { partyId = null } = {}) {
  if (!io || !event) return;
  const resolvedPartyId = Number(partyId || getSinglePartyId());
  io.to("dm").emit(event, payload);
  io.to(`party:${resolvedPartyId}`).emit(event, payload);
}

export function emitSinglePartyEvents(io, events, options = {}) {
  const list = Array.isArray(events) ? events : [];
  for (const entry of list) {
    if (typeof entry === "string") {
      emitSinglePartyEvent(io, entry, undefined, options);
      continue;
    }
    if (entry && typeof entry.event === "string") {
      emitSinglePartyEvent(io, entry.event, entry.payload, options);
    }
  }
}
