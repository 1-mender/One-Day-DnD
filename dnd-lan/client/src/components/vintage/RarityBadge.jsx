import React, { useMemo } from "react";
import * as Colors from "@radix-ui/colors";
import { getRarityLabel } from "../../lib/inventoryRarity.js";
import { Circle, Crown, Shield, Sparkles, Star } from "lucide-react";

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

function getIcon(key) {
  if (key === "legendary") return Crown;
  if (key === "very_rare") return Sparkles;
  if (key === "rare") return Star;
  if (key === "uncommon") return Shield;
  if (key === "custom") return Circle;
  return Circle;
}

export default function RarityBadge({ rarity }) {
  const rarityKey = String(rarity || "common").toLowerCase().replace(/\s+/g, "_");
  const label = getRarityLabel(rarityKey);
  const Icon = getIcon(rarityKey);

  const style = useMemo(() => {
    const palette = pickPalette(rarityKey);
    const scale = getScale(palette) || getScale(Colors.gray);
    const bg = scale?.get(3) || "#eee";
    const bg2 = scale?.get(5) || bg;
    const border = scale?.get(8) || "#999";
    const text = scale?.get(11) || "#222";
    const shadow = scale?.get(9) || "#000";
    const glint = scale?.get(2) || "#fff";
    return {
      background: `linear-gradient(180deg, ${bg}, ${bg2})`,
      borderColor: border,
      color: text,
      boxShadow: `0 6px 12px ${shadow}33`,
      "--medal-glint": glint,
      "--medal-shadow": shadow
    };
  }, [rarityKey]);

  return (
    <span
      className="rarity-medallion"
      style={style}
      title={label}
      aria-label={label}
      role="img"
    >
      <Icon className="rarity-medal-icon" aria-hidden="true" />
    </span>
  );
}
