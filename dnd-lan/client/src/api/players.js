import { request } from "./client.js";

export const playersApi = {
  players: () => request("/api/players", { method: "GET" }),
  me: () => request("/api/players/me", { method: "GET" }),
  dmPlayers: () => request("/api/players/dm/list", { method: "GET" }),
  dmUpdatePlayer: (playerId, patch) =>
    request(`/api/players/dm/${playerId}`, { method: "PUT", body: JSON.stringify(patch) }),
  dmDeletePlayer: (playerId) =>
    request(`/api/players/dm/${playerId}`, { method: "DELETE" })
};
