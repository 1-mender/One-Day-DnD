import React from "react";

export default function RarityRang({ rarity }) {
  const r = String(rarity || "common").toLowerCase().replace(/\s+/g, "_");
  const key =
    r === "very_rare" ? "very_rare" :
    r === "legendary" ? "legendary" :
    r === "uncommon" ? "uncommon" :
    r === "rare" ? "rare" :
    r === "custom" ? "custom" :
    "common";

  const labelMap = {
    common: "Общего доступа",
    uncommon: "Для служебного пользования",
    rare: "Секретно",
    very_rare: "Совершенно секретно",
    legendary: "Особой важности",
    custom: "Другое"
  };
  const label = labelMap[key] || key;

  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") {
    return <span className="rang fallback">{label}</span>;
  }

  let style = "";
  try {
    style = getComputedStyle(document.documentElement).getPropertyValue(`--tex-rang-${key}`).trim();
  } catch {
    style = "";
  }
  if (!style) {
    return <span className="rang fallback">{label}</span>;
  }

  return <div className={`rang ${key}`} title={label} />;
}
