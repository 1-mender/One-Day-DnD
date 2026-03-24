import { useCallback, useMemo, useState } from "react";
import { api } from "../../../api.js";
import { ERROR_CODES } from "../../../lib/errorCodes.js";
import { formatError } from "../../../lib/formatError.js";
import {
  applyTicketGamePatch,
  applyTicketRulesPatch,
  applyTicketShopPatch,
  buildGeneralChanges,
  createDailyQuestDraft,
  isDailyQuestChanged,
  isGameChanged,
  isShopChanged
} from "../domain/ticketRulesEditor.js";

export function useDmTicketRules({ readOnly }) {
  const [ticketRules, setTicketRules] = useState(null);
  const [ticketRulesBase, setTicketRulesBase] = useState(null);
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketMsg, setTicketMsg] = useState("");
  const [ticketErr, setTicketErr] = useState("");
  const [questConfirm, setQuestConfirm] = useState(null);

  const ticketDirty = useMemo(() => {
    if (!ticketRules || !ticketRulesBase) return false;
    return JSON.stringify(ticketRules) !== JSON.stringify(ticketRulesBase);
  }, [ticketRules, ticketRulesBase]);

  const ticketBase = ticketRulesBase || {};
  const ticketCur = ticketRules || {};
  const generalChanges = buildGeneralChanges(ticketCur, ticketBase);
  const dailyQuestChanged = isDailyQuestChanged(ticketCur, ticketBase);
  const showGeneralBlock = !showOnlyChanged || Object.values(generalChanges).some(Boolean);
  const showGeneralInputs = !showOnlyChanged || generalChanges.dailyEarnCap || generalChanges.streakMax || generalChanges.streakStep || generalChanges.streakFlatBonus;
  const showDailyQuestBlock = !showOnlyChanged || dailyQuestChanged;
  const gameEntries = Object.entries(ticketCur.games || {});
  const shopEntries = Object.entries(ticketCur.shop || {});
  const filteredGames = showOnlyChanged ? gameEntries.filter(([key, game]) => isGameChanged(ticketBase, key, game)) : gameEntries;
  const filteredShop = showOnlyChanged ? shopEntries.filter(([key, item]) => isShopChanged(ticketBase, key, item)) : shopEntries;

  const hydrateTicketRules = useCallback((rules) => {
    setTicketRules(rules);
    setTicketRulesBase(rules);
  }, []);

  function updateTicketRules(patch) {
    setTicketRules((prev) => applyTicketRulesPatch(prev, patch));
  }

  function addDailyQuest() {
    const draft = createDailyQuestDraft();
    const pool = [...(ticketRules?.dailyQuest?.pool || [])];
    pool.push(draft);
    const activeKey = ticketRules?.dailyQuest?.activeKey || draft.key;
    updateTicketRules({ dailyQuest: { pool, activeKey } });
  }

  function updateDailyQuest(index, patch) {
    const pool = [...(ticketRules?.dailyQuest?.pool || [])];
    if (!pool[index]) return;
    pool[index] = { ...pool[index], ...(patch || {}) };
    updateTicketRules({ dailyQuest: { pool } });
  }

  function removeDailyQuest(index) {
    const pool = [...(ticketRules?.dailyQuest?.pool || [])];
    const removed = pool.splice(index, 1)[0];
    let activeKey = ticketRules?.dailyQuest?.activeKey || "";
    if (removed?.key && removed.key === activeKey) {
      activeKey = pool.find((quest) => quest.enabled !== false)?.key || pool[0]?.key || "";
    }
    updateTicketRules({ dailyQuest: { pool, activeKey } });
  }

  function setActiveDailyQuest(key) {
    updateTicketRules({ dailyQuest: { activeKey: key } });
  }

  function resetDailyQuestToday() {
    if (readOnly) return;
    const activeKey = ticketRules?.dailyQuest?.activeKey || "";
    if (!activeKey) {
      setTicketErr("Нет активного ежедневного квеста.");
      return;
    }
    setQuestConfirm({ action: "reset", activeKey });
  }

  function reassignDailyQuestToday() {
    if (readOnly) return;
    const activeKey = ticketRules?.dailyQuest?.activeKey || "";
    if (!activeKey) {
      setTicketErr("Нет активного ежедневного квеста.");
      return;
    }
    setQuestConfirm({ action: "reassign", activeKey });
  }

  async function confirmDailyQuestAction() {
    if (!questConfirm || readOnly) return;
    setTicketErr("");
    setTicketMsg("");
    setTicketBusy(true);
    try {
      if (questConfirm.action === "reset") {
        await api.dmTicketsResetQuest(questConfirm.activeKey);
        setTicketMsg("Ежедневный квест сброшен на сегодня.");
      }
      if (questConfirm.action === "reassign") {
        await api.dmTicketsSetActiveQuest(questConfirm.activeKey);
        setTicketMsg("Ежедневный квест переназначен на сегодня.");
        setTicketRulesBase((prev) => (
          prev ? { ...prev, dailyQuest: { ...(prev.dailyQuest || {}), activeKey: questConfirm.activeKey } } : prev
        ));
      }
      setQuestConfirm(null);
    } catch (e) {
      setTicketErr(formatError(e));
    } finally {
      setTicketBusy(false);
    }
  }

  function closeQuestConfirm() {
    setQuestConfirm(null);
  }

  function updateTicketGame(key, patch) {
    setTicketRules((prev) => applyTicketGamePatch(prev, key, patch));
  }

  function updateTicketShop(key, patch) {
    setTicketRules((prev) => applyTicketShopPatch(prev, key, patch));
  }

  async function saveTicketRules() {
    if (readOnly || !ticketRules) return;
    setTicketErr("");
    setTicketMsg("");
    setTicketBusy(true);
    try {
      const response = await api.dmTicketsUpdateRules({
        enabled: ticketRules.enabled ?? true,
        rules: ticketRules
      });
      hydrateTicketRules(response.rules || null);
      setTicketMsg("Правила сохранены.");
    } catch (e) {
      setTicketErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
    } finally {
      setTicketBusy(false);
    }
  }

  async function resetTicketRules() {
    if (readOnly) return;
    setTicketErr("");
    setTicketMsg("");
    setTicketBusy(true);
    try {
      const response = await api.dmTicketsUpdateRules({ reset: true });
      hydrateTicketRules(response.rules || null);
      setTicketMsg("Правила сброшены к дефолту.");
    } catch (e) {
      setTicketErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
    } finally {
      setTicketBusy(false);
    }
  }

  return {
    ticketRules,
    showOnlyChanged,
    setShowOnlyChanged,
    ticketBusy,
    ticketMsg,
    ticketErr,
    questConfirm,
    ticketDirty,
    generalChanges,
    showGeneralBlock,
    showGeneralInputs,
    showDailyQuestBlock,
    filteredGames,
    filteredShop,
    hydrateTicketRules,
    updateTicketRules,
    addDailyQuest,
    updateDailyQuest,
    removeDailyQuest,
    setActiveDailyQuest,
    resetDailyQuestToday,
    reassignDailyQuestToday,
    confirmDailyQuestAction,
    closeQuestConfirm,
    updateTicketGame,
    updateTicketShop,
    saveTicketRules,
    resetTicketRules
  };
}
