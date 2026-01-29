import React from "react";

export default function PlayerStatusPill({ status }) {
  const s = String(status || "offline");
  const cls = s === "online" ? "online" : s === "idle" ? "idle" : "offline";
  const label = s === "online" ? "ONLINE" : s === "idle" ? "IDLE" : "OFFLINE";
  return <span className={`stamp ${cls}`}>{label}</span>;
}
