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

  if (typeof document === "undefined" || typeof getComputedStyle === "undefined") {
    return <span className="rang fallback">{key}</span>;
  }

  let style = "";
  try {
    style = getComputedStyle(document.documentElement).getPropertyValue(`--tex-rang-${key}`).trim();
  } catch {
    style = "";
  }
  if (!style) {
    return <span className="rang fallback">{key}</span>;
  }

  return <div className={`rang ${key}`} title={key} />;
}
