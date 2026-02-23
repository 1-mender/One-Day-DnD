import React from "react";
import { t } from "../i18n/index.js";

export default function PlayerStatusPill({ status }) {
  const raw = String(status || "offline");
  const cls = raw === "online" ? "online" : raw === "idle" ? "idle" : "offline";
  const label = raw === "online"
    ? t("playerStatus.online")
    : raw === "idle"
      ? t("playerStatus.idle")
      : t("playerStatus.offline");
  return <span className={`stamp ${cls}`}>{label}</span>;
}
