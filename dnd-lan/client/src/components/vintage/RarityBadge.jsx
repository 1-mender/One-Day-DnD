import React, { useMemo } from "react";
import * as Colors from "@radix-ui/colors";
import { getRarityLabel } from "../../lib/inventoryRarity.js";

function getScale(palette) {
  if (!palette) return null;
  const keys = Object.keys(palette);
  if (!keys.length) return null;
  const base = keys[0].replace(/\d+$/, "");
  return {
    get: (n) => palette[`${base}${n}`]
  };
}

function pickPalette(key) {
  const map = {
    common: Colors.sand || Colors.gray,
    uncommon: Colors.green,
    rare: Colors.blue,
    very_rare: Colors.purple,
    legendary: Colors.amber || Colors.gold,
    custom: Colors.bronze || Colors.brown || Colors.gray
  };
  return map[key] || Colors.gray;
}

export default function RarityBadge({ rarity }) {
  const rarityKey = String(rarity || "common").toLowerCase().replace(/\s+/g, "_");
  const label = getRarityLabel(rarityKey);

  const style = useMemo(() => {
    const palette = pickPalette(rarityKey);
    const scale = getScale(palette) || getScale(Colors.gray);
    const bg = scale?.get(3) || "#eee";
    const bg2 = scale?.get(4) || bg;
    const border = scale?.get(7) || "#999";
    const text = scale?.get(11) || "#222";
    const shadow = scale?.get(8) || "#000";
    return {
      background: `linear-gradient(180deg, ${bg}, ${bg2})`,
      borderColor: border,
      color: text,
      boxShadow: `0 4px 10px ${shadow}33`
    };
  }, [rarityKey]);

  return (
    <span className="badge rarity" style={style}>
      {label}
    </span>
  );
}
