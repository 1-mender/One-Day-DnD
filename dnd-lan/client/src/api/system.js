import { request } from "./client.js";

export const systemApi = {
  serverInfo: () => request("/api/server/info", { method: "GET" }),
  serverMetrics: () => request("/api/server/metrics", { method: "GET" }),
  dmSetup: (username, password, setupSecret = "") =>
    request("/api/dm/setup", { method: "POST", body: JSON.stringify({ username, password, setupSecret }) })
};
