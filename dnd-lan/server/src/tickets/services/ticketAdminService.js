import { getPartySettings } from "../../db.js";
import { logEvent } from "../../events.js";
import { emitSinglePartyEvent } from "../../singlePartyEmit.js";
import { jsonParse, now } from "../../util.js";
import { mergeRules } from "../domain/rules.js";
import { getActiveQuest } from "./dailyQuestService.js";
import { buildTicketPayload, ensureTicketRow, normalizeDay } from "./ticketStateService.js";
import { getEffectiveRules, saveRulesOverride } from "./ticketRulesService.js";
import { getDayKey, isPlainObject } from "../shared/ticketUtils.js";

function error(status, code) {
  return { ok: false, status, body: { error: code } };
}

function normalizeAdjustInput(body) {
  return {
    delta: Number(body?.delta || 0),
    set: body?.set != null ? Number(body.set) : null,
    reason: String(body?.reason || "").trim()
  };
}

function adjustPlayerTicketsInternal({
  db,
  playerId,
  delta,
  set,
  reason,
  partyId,
  io,
  buildMatchmakingPayload,
  emitPlayerUpdate = false,
  emitDmUpdate = false,
  writeLog = false
}) {
  const player = db.prepare("SELECT id, party_id, display_name FROM players WHERE id=?").get(playerId);
  if (!player) {
    return {
      ok: false,
      status: 404,
      body: { error: "player_not_found" },
      playerId
    };
  }
  if (partyId && Number(player.party_id) !== Number(partyId)) {
    return {
      ok: false,
      status: 404,
      body: { error: "player_not_found" },
      playerId
    };
  }

  let row = ensureTicketRow(db, playerId);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const nextBalance = Math.max(0, set != null ? set : Number(row.balance || 0) + delta);
  const t = now();
  db.prepare("UPDATE tickets SET balance=?, updated_at=? WHERE player_id=?").run(nextBalance, t, playerId);

  if (emitPlayerUpdate) {
    io?.to(`player:${playerId}`).emit("tickets:updated");
  }
  if (emitDmUpdate) {
    io?.to("dm").emit("tickets:updated");
  }

  if (writeLog) {
    logEvent({
      partyId: player.party_id,
      type: "tickets.adjust",
      actorRole: "dm",
      actorName: "DM",
      targetType: "player",
      targetId: playerId,
      message: `DM adjust tickets: ${set != null ? `set ${set}` : `delta ${delta}`}${reason ? ` (${reason})` : ""}`,
      data: { playerId, delta, set, reason },
      io
    });
  }

  const rules = getEffectiveRules(player.party_id);
  const payload = buildTicketPayload(db, playerId, dayKey, rules, {
    partyId: player.party_id,
    buildMatchmakingPayload
  });

  return {
    ok: true,
    status: 200,
    playerId,
    displayName: String(player.display_name || ""),
    body: payload
  };
}

export function updateDmRules({ party, body, io }) {
  const curSettings = getPartySettings(party.id);
  const currentOverrides = jsonParse(curSettings?.tickets_rules, {});

  const reset = !!body?.reset;
  const incoming = body?.rules && isPlainObject(body.rules) ? { ...body.rules } : {};

  const enabledInput = body?.enabled;
  const enabled = typeof enabledInput === "boolean" ? enabledInput : (incoming?.enabled ?? curSettings?.tickets_enabled);
  if ("enabled" in incoming) delete incoming.enabled;

  const prevRules = getEffectiveRules(party.id);
  const overrides = reset ? {} : mergeRules(currentOverrides, incoming);
  saveRulesOverride(party.id, enabled, overrides);

  emitSinglePartyEvent(io, "settings:updated", undefined, { partyId: party.id });
  emitSinglePartyEvent(io, "tickets:updated", undefined, { partyId: party.id });

  const rules = getEffectiveRules(party.id);
  const prevActive = prevRules?.dailyQuest?.activeKey || "";
  const nextActive = rules?.dailyQuest?.activeKey || "";
  if (prevActive !== nextActive) {
    logEvent({
      partyId: party.id,
      type: "dailyquest.active_changed",
      actorRole: "dm",
      actorName: "DM",
      targetType: "daily_quest",
      targetId: null,
      message: `Active daily quest: ${prevActive || "-"} -> ${nextActive || "-"}`,
      data: { prevActive, nextActive },
      io
    });
  }
  return { ok: true, status: 200, body: { rules } };
}

export function setActiveDailyQuest({ party, body, io }) {
  const questKey = String(body?.questKey || "").trim();
  if (!questKey) return error(400, "quest_key_required");

  const rules = getEffectiveRules(party.id);
  const pool = Array.isArray(rules?.dailyQuest?.pool) ? rules.dailyQuest.pool : [];
  const nextQuest = pool.find((q) => q.key === questKey && q.enabled !== false);
  if (!nextQuest) return error(400, "invalid_quest_key");

  const curSettings = getPartySettings(party.id);
  const currentOverrides = jsonParse(curSettings?.tickets_rules, {});
  const nextOverrides = mergeRules(currentOverrides, { dailyQuest: { activeKey: questKey } });
  saveRulesOverride(party.id, curSettings?.tickets_enabled, nextOverrides);

  const prevActive = rules?.dailyQuest?.activeKey || "";
  if (prevActive !== questKey) {
    logEvent({
      partyId: party.id,
      type: "dailyquest.active_changed",
      actorRole: "dm",
      actorName: "DM",
      targetType: "daily_quest",
      targetId: null,
      message: `Active daily quest: ${prevActive || "-"} -> ${questKey || "-"}`,
      data: { prevActive, nextActive: questKey },
      io
    });
  }

  emitSinglePartyEvent(io, "tickets:updated", undefined, { partyId: party.id });
  return { ok: true, status: 200, body: { ok: true, activeKey: questKey } };
}

export function resetDailyQuest({ db, party, body, io }) {
  const rules = getEffectiveRules(party.id);
  const q = getActiveQuest(rules);

  const dayKey = Number(body?.dayKey ?? getDayKey());
  const questKey = String(body?.questKey || q?.key || "").trim();
  if (!questKey) return error(400, "quest_key_required");
  if (!Number.isFinite(dayKey) || dayKey <= 0) return error(400, "invalid_day_key");

  const r = db.prepare(
    `DELETE FROM ticket_quests
     WHERE quest_key=? AND day_key=?
       AND player_id IN (SELECT id FROM players WHERE party_id=?)`
  ).run(questKey, dayKey, party.id);

  io?.to("dm").emit("tickets:updated");
  logEvent({
    partyId: party.id,
    type: "dailyquest.reset",
    actorRole: "dm",
    actorName: "DM",
    targetType: "daily_quest",
    targetId: null,
    message: `Reset daily quest: ${questKey} (dayKey=${dayKey})`,
    data: { questKey, dayKey, deleted: r.changes || 0 },
    io
  });
  return { ok: true, status: 200, body: { ok: true, questKey, dayKey, deleted: r.changes || 0 } };
}

export function listDmTickets({ db, partyId }) {
  const rows = db.prepare(
    `
    SELECT p.id as playerId,
           p.display_name as displayName,
           COALESCE(t.balance, 0) as balance,
           COALESCE(t.streak, 0) as streak,
           COALESCE(t.daily_earned, 0) as dailyEarned,
           COALESCE(t.daily_spent, 0) as dailySpent,
           t.updated_at as updatedAt
    FROM players p
    LEFT JOIN tickets t ON t.player_id = p.id
    WHERE p.party_id=? AND p.banned=0
    ORDER BY p.id
  `
  ).all(partyId);
  return { ok: true, status: 200, body: { items: rows } };
}

export function adjustPlayerTickets({ db, party, body, io, buildMatchmakingPayload }) {
  const playerId = Number(body?.playerId);
  if (!playerId) return error(400, "invalid_playerId");

  const { delta, set, reason } = normalizeAdjustInput(body);
  const result = adjustPlayerTicketsInternal({
    db,
    playerId,
    delta,
    set,
    reason,
    partyId: party?.id,
    io,
    buildMatchmakingPayload,
    emitPlayerUpdate: true,
    emitDmUpdate: true,
    writeLog: true
  });
  return {
    ok: result.ok,
    status: result.status,
    body: result.body
  };
}

export function adjustPlayerTicketsBulk({ db, party, body, io, buildMatchmakingPayload }) {
  const playerIds = Array.from(new Set((Array.isArray(body?.playerIds) ? body.playerIds : []).map((value) => Number(value)).filter(Boolean)));
  if (!playerIds.length) return error(400, "invalid_playerIds");

  const { delta, set, reason } = normalizeAdjustInput(body);
  const items = [];
  const updatedPlayerIds = [];

  for (const playerId of playerIds) {
    const result = adjustPlayerTicketsInternal({
      db,
      playerId,
      delta,
      set,
      reason,
      partyId: party?.id,
      io,
      buildMatchmakingPayload
    });
    if (result.ok) {
      updatedPlayerIds.push(playerId);
      items.push({
        playerId,
        displayName: result.displayName,
        ok: true,
        balance: Number(result.body?.state?.balance || 0),
        streak: Number(result.body?.state?.streak || 0)
      });
    } else {
      items.push({
        playerId,
        ok: false,
        error: result.body?.error || "request_failed"
      });
    }
  }

  for (const playerId of updatedPlayerIds) {
    io?.to(`player:${playerId}`).emit("tickets:updated");
  }
  if (updatedPlayerIds.length) {
    io?.to("dm").emit("tickets:updated");
  }

  logEvent({
    partyId: party?.id,
    type: "tickets.adjust_bulk",
    actorRole: "dm",
    actorName: "DM",
    targetType: "player_group",
    targetId: null,
    message: `DM bulk adjust tickets: ${set != null ? `set ${set}` : `delta ${delta}`}${reason ? ` (${reason})` : ""}`,
    data: {
      playerIds,
      delta,
      set,
      reason,
      appliedCount: updatedPlayerIds.length,
      failedCount: items.filter((item) => !item.ok).length
    },
    io
  });

  return {
    ok: true,
    status: 200,
    body: {
      items,
      appliedCount: updatedPlayerIds.length,
      failedCount: items.filter((item) => !item.ok).length,
      skippedCount: Math.max(0, (Array.isArray(body?.playerIds) ? body.playerIds.length : 0) - playerIds.length)
    }
  };
}
