import { logEvent } from "../../events.js";
import { getDayKey } from "../shared/ticketUtils.js";
import { buildTicketPayload, ensureTicketRow, normalizeDay } from "./ticketStateService.js";
import { getEffectiveRules } from "./ticketRulesService.js";

function error(status, code) {
  return { ok: false, status, body: { error: code } };
}

export function processTicketPurchase({ db, io, me, body, nowFn, buildMatchmakingPayload }) {
  const itemKey = String(body?.itemKey || "").trim();
  const rules = getEffectiveRules(me.player.party_id);
  if (!rules.enabled) return error(400, "tickets_disabled");
  const item = rules.shop?.[itemKey];
  if (!item) return error(400, "invalid_item");
  if (item.enabled === false) return error(400, "item_disabled");

  let row = ensureTicketRow(db, me.player.id);
  const dayKey = getDayKey();
  row = normalizeDay(db, row, dayKey);

  const spentToday = db
    .prepare("SELECT COALESCE(SUM(qty),0) as c FROM ticket_purchases WHERE player_id=? AND day_key=? AND item_key=?")
    .get(me.player.id, dayKey, itemKey)?.c || 0;
  if (item.dailyLimit && spentToday >= item.dailyLimit) return error(400, "daily_item_limit");

  const price = Number(item.price || 0);
  if (price > 0 && row.balance < price) return error(400, "not_enough_tickets");

  const spendCap = Number(rules.dailySpendCap || 0);
  if (spendCap > 0) {
    const projectedSpend = Number(row.daily_spent || 0) + price;
    if (projectedSpend > spendCap) return error(400, "daily_spend_cap");
  }

  const t = nowFn();
  const balance = Math.max(0, Number(row.balance || 0) - price);
  const dailySpent = Number(row.daily_spent || 0) + price;

  db.prepare(
    "UPDATE tickets SET balance=?, daily_spent=?, updated_at=? WHERE player_id=?"
  ).run(balance, dailySpent, t, me.player.id);
  db.prepare(
    "INSERT INTO ticket_purchases(player_id, item_key, qty, cost, day_key, created_at) VALUES(?,?,?,?,?,?)"
  ).run(me.player.id, itemKey, 1, price, dayKey, t);

  io?.to(`player:${me.player.id}`).emit("tickets:updated");
  io?.to("dm").emit("tickets:updated");

  logEvent({
    partyId: me.player.party_id,
    type: "tickets.purchase",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "player",
    targetId: me.player.id,
    message: `Purchase ${itemKey} for ${price}`,
    data: { itemKey, price },
    io
  });

  return {
    ok: true,
    status: 200,
    body: {
      ...buildTicketPayload(db, me.player.id, dayKey, rules, {
        partyId: me.player.party_id,
        buildMatchmakingPayload
      }),
      result: { itemKey, price }
    }
  };
}
