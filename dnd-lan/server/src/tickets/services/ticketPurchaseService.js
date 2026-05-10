import { logEvent } from "../../events.js";
import { grantInventoryItem } from "../../inventory/services/inventoryGrantService.js";
import { pickChestReward } from "../domain/chestRewards.js";
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
  const dailyShopCap = Number(rules.dailyShopCap || 0);
  if (dailyShopCap > 0) {
    const purchasesToday = Number(
      db.prepare("SELECT COALESCE(SUM(qty),0) as c FROM ticket_purchases WHERE player_id=? AND day_key=?")
        .get(me.player.id, dayKey)?.c || 0
    );
    if (purchasesToday >= dailyShopCap) return error(400, "daily_shop_limit");
  }

  const price = Number(item.price || 0);
  if (price > 0 && row.balance < price) return error(400, "not_enough_tickets");

  const spendCap = Number(rules.dailySpendCap || 0);
  if (spendCap > 0) {
    const projectedSpend = Number(row.daily_spent || 0) + price;
    if (projectedSpend > spendCap) return error(400, "daily_spend_cap");
  }

  let purchaseResult = { itemKey, price };
  let balance = Number(row.balance || 0);

  try {
    const tx = db.transaction(() => {
      const t = nowFn();
      const nextBalance = Math.max(0, Number(row.balance || 0) - price);
      const dailySpent = Number(row.daily_spent || 0) + price;

      db.prepare(
        "UPDATE tickets SET balance=?, daily_spent=?, updated_at=? WHERE player_id=?"
      ).run(nextBalance, dailySpent, t, me.player.id);
      db.prepare(
        "INSERT INTO ticket_purchases(player_id, item_key, qty, cost, day_key, created_at) VALUES(?,?,?,?,?,?)"
      ).run(me.player.id, itemKey, 1, price, dayKey, t);

      let reward = null;
      if (itemKey === "chest") {
        const picked = pickChestReward();
        const granted = grantInventoryItem({
          db,
          playerId: me.player.id,
          item: picked.item,
          nowValue: t,
          updatedBy: "system"
        });
        reward = {
          type: "inventory_item",
          rewardKey: picked.key,
          itemId: granted.id,
          name: granted.name,
          description: granted.description,
          rarity: granted.rarity,
          qty: granted.qty,
          visibility: granted.visibility,
          tags: granted.tags,
          iconKey: granted.tags.find((tag) => String(tag).startsWith("icon:"))?.slice(5) || "",
          container: granted.container,
          slotX: granted.slotX,
          slotY: granted.slotY
        };
      }

      return {
        balance: nextBalance,
        dailySpent,
        reward,
        t
      };
    });

    const committed = tx();
    balance = committed.balance;
    purchaseResult = { itemKey, price, reward: committed.reward };
  } catch (e) {
    return error(Number(e?.status || 400), e?.code || "purchase_failed", e?.extra || null);
  }

  io?.to(`player:${me.player.id}`).emit("tickets:updated");
  if (purchaseResult.reward?.type === "inventory_item") {
    io?.to(`player:${me.player.id}`).emit("inventory:updated");
  }
  io?.to("dm").emit("tickets:updated");
  if (purchaseResult.reward?.type === "inventory_item") {
    io?.to("dm").emit("inventory:updated");
  }

  logEvent({
    partyId: me.player.party_id,
    type: "tickets.purchase",
    actorRole: "player",
    actorPlayerId: me.player.id,
    actorName: me.player.display_name,
    targetType: "player",
    targetId: me.player.id,
    message: purchaseResult.reward
      ? `Purchase ${itemKey} for ${price}, reward ${purchaseResult.reward.name}`
      : `Purchase ${itemKey} for ${price}`,
    data: purchaseResult.reward ? { itemKey, price, reward: purchaseResult.reward } : { itemKey, price },
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
      result: purchaseResult
    }
  };
}
