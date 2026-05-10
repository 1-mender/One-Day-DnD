import { request } from "./client.js";
import { storage } from "./storage.js";

export const authApi = {
  dmLogin: (username, password) => request("/api/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  dmLogout: () => request("/api/auth/logout", { method: "POST" }),
  dmMe: () => request("/api/auth/me", { method: "GET" }),
  dmChangePassword: (newPassword) => request("/api/auth/change-password", { method: "POST", body: JSON.stringify({ newPassword }) }),
  playerSessionStart: async (playerToken) => {
    const token = String(playerToken || storage.getPlayerToken() || "");
    if (!token) throw new Error("player_token_required");
    const result = await request("/api/auth/player/session", {
      method: "POST",
      body: JSON.stringify({ playerToken: token })
    });
    storage.clearPlayerToken();
    return result;
  },
  playerLogout: async () => {
    try {
      return await request("/api/auth/player/logout", { method: "POST" });
    } finally {
      storage.clearPlayerToken();
      storage.clearImpersonating();
      storage.clearImpMode();
    }
  }
};
