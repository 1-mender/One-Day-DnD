import { request } from "./client.js";

export const partyApi = {
  joinRequest: (displayName, joinCode) =>
    request("/api/party/join-request", { method: "POST", body: JSON.stringify({ displayName, joinCode }) }),
  dmRequests: () => request("/api/party/requests", { method: "GET" }),
  dmApprove: (joinRequestId) => request("/api/party/approve", { method: "POST", body: JSON.stringify({ joinRequestId }) }),
  dmReject: (joinRequestId) => request("/api/party/reject", { method: "POST", body: JSON.stringify({ joinRequestId }) }),
  dmBan: (joinRequestId) => request("/api/party/ban", { method: "POST", body: JSON.stringify({ joinRequestId }) }),
  dmKick: (playerId) => request("/api/party/kick", { method: "POST", body: JSON.stringify({ playerId }) }),
  dmGetJoinCode: () => request("/api/party/join-code", { method: "GET" }),
  dmSetJoinCode: (joinCode) => request("/api/party/join-code", { method: "POST", body: JSON.stringify({ joinCode }) }),
  dmImpersonate: (playerId, mode = "ro") =>
    request("/api/party/impersonate", { method: "POST", body: JSON.stringify({ playerId, mode }) })
};
