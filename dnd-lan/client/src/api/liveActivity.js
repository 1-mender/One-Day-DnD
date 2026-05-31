import { request } from "./client.js";

export const liveActivityApi = {
  playerLiveActivityMe: () => request("/api/live-activity/me", { method: "GET" }),
  
  // Допишите эту строчку:
  playerCloseLiveActivity: () => request("/api/live-activity/close-me", { method: "POST" }),

  dmOpenPlayerLiveActivity: (playerId, payload = {}) => //
    request(`/api/live-activity/dm/player/${encodeURIComponent(playerId)}/open`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    })
};
