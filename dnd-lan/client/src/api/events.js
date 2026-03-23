import { ERROR_CODES, request, requestBlob } from "./client.js";

export const eventsApi = {
  dmEventsList: async ({
    limit = 200,
    offset = 0,
    q = "",
    type = "",
    prefix = "",
    actorRole = "",
    playerId = "",
    since = ""
  } = {}) => {
    const params = new URLSearchParams();
    params.set("limit", String(limit));
    params.set("offset", String(offset));
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (prefix) params.set("prefix", prefix);
    if (actorRole) params.set("actorRole", actorRole);
    if (playerId) params.set("playerId", String(playerId));
    if (since) params.set("since", String(since));
    return request(`/api/events?${params.toString()}`, { method: "GET" });
  },
  dmEventsExportJson: async ({
    q = "",
    type = "",
    prefix = "",
    actorRole = "",
    playerId = "",
    since = "",
    max = 20000
  } = {}) => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (type) params.set("type", type);
    if (prefix) params.set("prefix", prefix);
    if (actorRole) params.set("actorRole", actorRole);
    if (playerId) params.set("playerId", String(playerId));
    if (since) params.set("since", String(since));
    params.set("max", String(max));
    return requestBlob(`/api/events/export?${params.toString()}`, ERROR_CODES.EXPORT_FAILED);
  },
  dmEventsCleanup: (payload) =>
    request("/api/events/cleanup", { method: "POST", body: JSON.stringify(payload) })
};
