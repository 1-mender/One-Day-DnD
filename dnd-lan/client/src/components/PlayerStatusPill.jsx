import React from "react";

export default function PlayerStatusPill({ status }) {
  const s = String(status || "offline");
  const cls = s === "online" ? "ok" : s === "idle" ? "warn" : "off";
  const label = s === "online" ? "Online" : s === "idle" ? "Idle" : "Offline";
  return <span className={`badge ${cls}`}>{label}</span>;
}
