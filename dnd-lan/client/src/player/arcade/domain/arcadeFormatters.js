export function impactClass(label) {
  const v = String(label || "").toLowerCase();
  if (v.includes("СЃР»РѕР¶") || v.includes("hard") || v.includes("high") || v.includes("РІС‹СЃРѕРє")) return "impact-high";
  if (v.includes("СЃСЂРµРґ") || v.includes("mid") || v.includes("medium")) return "impact-mid";
  if (v.includes("Р»РµРі") || v.includes("easy") || v.includes("РЅРёР·")) return "impact-low";
  return "impact-low";
}

export function formatEntry(entry) {
  const qty = Number(entry || 0);
  if (!qty) return "Р’С…РѕРґ: Р±РµСЃРїР»Р°С‚РЅРѕ";
  return `Р’С…РѕРґ: ${qty} ${qty === 1 ? "Р±РёР»РµС‚" : qty < 5 ? "Р±РёР»РµС‚Р°" : "Р±РёР»РµС‚РѕРІ"}`;
}

export function formatDayKey(dayKey) {
  const n = Number(dayKey);
  if (!Number.isFinite(n) || n <= 0) return String(dayKey || "");
  const d = new Date(n * 24 * 60 * 60 * 1000);
  const months = ["СЏРЅРІ", "С„РµРІ", "РјР°СЂ", "Р°РїСЂ", "РјР°Р№", "РёСЋРЅ", "РёСЋР»", "Р°РІРі", "СЃРµРЅ", "РѕРєС‚", "РЅРѕСЏ", "РґРµРє"];
  const day = String(d.getUTCDate()).padStart(2, "0");
  const month = months[d.getUTCMonth()] || "";
  return month ? `${day} ${month}` : day;
}

export function formatDurationMs(ms) {
  const total = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  if (m <= 0) return `${s}s`;
  return `${m}m ${String(s).padStart(2, "0")}s`;
}

export function formatTicketError(code) {
  const c = String(code || "");
  if (c === "tickets_disabled") return "РђСЂРєР°РґР° РІСЂРµРјРµРЅРЅРѕ Р·Р°РєСЂС‹С‚Р°.";
  if (c === "game_disabled") return "Р­С‚Р° РёРіСЂР° СЃРµР№С‡Р°СЃ Р·Р°РєСЂС‹С‚Р°.";
  if (c === "not_enough_tickets") return "РќРµРґРѕСЃС‚Р°С‚РѕС‡РЅРѕ Р±РёР»РµС‚РѕРІ РґР»СЏ РІС…РѕРґР°.";
  if (c === "daily_game_limit") return "Р”РѕСЃС‚РёРіРЅСѓС‚ РґРЅРµРІРЅРѕР№ Р»РёРјРёС‚ РїРѕРїС‹С‚РѕРє.";
  if (c === "daily_spend_cap") return "Р”РѕСЃС‚РёРіРЅСѓС‚ РґРЅРµРІРЅРѕР№ Р»РёРјРёС‚ С‚СЂР°С‚.";
  if (c === "invalid_performance") return "РќРµРІРµСЂРЅС‹Р№ Р±РѕРЅСѓСЃ РІС‹РїРѕР»РЅРµРЅРёСЏ.";
  if (c === "invalid_seed") return "РЎРµСЃСЃРёСЏ РёРіСЂС‹ СѓСЃС‚Р°СЂРµР»Р°. РћС‚РєСЂРѕР№С‚Рµ РёРіСЂСѓ СЃРЅРѕРІР°.";
  if (c === "invalid_proof") return "Р РµР·СѓР»СЊС‚Р°С‚ РёРіСЂС‹ РЅРµ РїСЂРѕС€РµР» РїСЂРѕРІРµСЂРєСѓ.";
  if (c === "invalid_game") return "Р­С‚Р° РёРіСЂР° РЅРµРґРѕСЃС‚СѓРїРЅР°.";
  if (c === "invalid_mode") return "Selected mode is not available.";
  if (c === "invalid_outcome") return "Invalid match outcome.";
  if (c === "already_in_queue") return "You are already in queue.";
  if (c === "already_submitted") return "Result is already submitted.";
  if (c === "match_not_found") return "Match not found.";
  if (c === "opponent_not_found") return "Opponent not found.";
  if (c === "winner_locked") return "Winner is already locked.";
  if (c === "forbidden") return "Action is not allowed.";
  return c || "РћС€РёР±РєР°";
}

export function isGameLimitReached(gameKey, rules, usage) {
  const lim = rules?.games?.[gameKey]?.dailyLimit;
  if (!lim) return false;
  const used = usage?.playsToday?.[gameKey] || 0;
  return used >= lim;
}
