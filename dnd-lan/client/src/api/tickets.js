import { request } from "./client.js";

export const ticketsApi = {
  ticketsMe: () => request("/api/tickets/me", { method: "GET" }),
  ticketsRules: () => request("/api/tickets/rules", { method: "GET" }),
  ticketsCatalog: () => request("/api/tickets/catalog", { method: "GET" }),
  ticketsSeed: (gameKey) => request(`/api/tickets/seed?gameKey=${encodeURIComponent(gameKey)}`, { method: "GET" }),
  ticketsPlay: (payload) => request("/api/tickets/play", { method: "POST", body: JSON.stringify(payload) }),
  ticketsGameStart: (gameKey, payload = {}) =>
    request(`/api/tickets/games/${encodeURIComponent(gameKey)}/start`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    }),
  ticketsGameMove: (sessionId, payload = {}) =>
    request(`/api/tickets/games/sessions/${encodeURIComponent(sessionId)}/move`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    }),
  ticketsGameFinish: (sessionId, payload = {}) =>
    request(`/api/tickets/games/sessions/${encodeURIComponent(sessionId)}/finish`, {
      method: "POST",
      body: JSON.stringify(payload || {})
    }),
  ticketsPurchase: (payload) => request("/api/tickets/purchase", { method: "POST", body: JSON.stringify(payload) }),
  ticketsQueueMatchmaking: (payload) =>
    request("/api/tickets/matchmaking/queue", { method: "POST", body: JSON.stringify(payload) }),
  ticketsCancelMatchmaking: (queueId = null) =>
    request("/api/tickets/matchmaking/cancel", { method: "POST", body: JSON.stringify({ queueId }) }),
  ticketsMatchHistory: (limit = 20) =>
    request(`/api/tickets/matches/history?limit=${encodeURIComponent(limit)}`, { method: "GET" }),
  ticketsRematch: (matchId) =>
    request(`/api/tickets/matches/${encodeURIComponent(matchId)}/rematch`, { method: "POST" }),
  ticketsCompleteMatch: (matchId, payload = {}) =>
    request(`/api/tickets/matches/${encodeURIComponent(matchId)}/complete`, { method: "POST", body: JSON.stringify(payload) }),
  dmTicketsRules: () => request("/api/tickets/dm/rules", { method: "GET" }),
  dmTicketsMetrics: (days = 7) =>
    request(`/api/tickets/dm/metrics?days=${encodeURIComponent(days)}`, { method: "GET" }),
  dmTicketsUpdateRules: (payload) => request("/api/tickets/dm/rules", { method: "PUT", body: JSON.stringify(payload) }),
  dmTicketsSetActiveQuest: (questKey) =>
    request("/api/tickets/dm/quest/active", { method: "POST", body: JSON.stringify({ questKey }) }),
  dmTicketsResetQuest: (questKey, dayKey = null) =>
    request("/api/tickets/dm/quest/reset", { method: "POST", body: JSON.stringify({ questKey, dayKey }) }),
  dmTicketsList: () => request("/api/tickets/dm/list", { method: "GET" }),
  dmTicketsAdjust: (payload) => request("/api/tickets/dm/adjust", { method: "POST", body: JSON.stringify(payload) })
};
