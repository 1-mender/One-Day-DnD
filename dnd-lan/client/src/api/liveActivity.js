import { request } from "./client.js";

export const liveActivityApi = {
  playerLiveActivityMe: () => request("/api/live-activity/me", { method: "GET" }),
  dmOpenPlayerLiveActivity: (playerId, payload = {}) =>
    request(`/api/live-activity/dm/player/${encodeURIComponent(playerId)}/open`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    }),
  dmClosePlayerLiveActivity: (playerId, payload = {}) =>
    request(`/api/live-activity/dm/player/${encodeURIComponent(playerId)}/close`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    })
};
