import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api.js";
import { useSocket } from "../../context/SocketContext.jsx";
import { useReadOnly } from "../../hooks/useReadOnly.js";
import { ERROR_CODES } from "../../lib/errorCodes.js";
import { formatError } from "../../lib/formatError.js";
import {
  applyTicketGamePatch,
  applyTicketRulesPatch,
  applyTicketShopPatch,
  buildGeneralChanges,
  createDailyQuestDraft,
  isDailyQuestChanged,
  isGameChanged,
  isShopChanged
} from "./domain/ticketRulesEditor.js";
import {
  DEFAULT_PRESET_ACCESS,
  addProfilePresetItem,
  normalizePresetAccess,
  removeProfilePresetItem,
  updateProfilePresetData,
  updateProfilePresetItem
} from "./domain/presetsEditor.js";

export function useDmSettings() {
  const [joinEnabled, setJoinEnabled] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [showJoin, setShowJoin] = useState(false);

  const [newPass, setNewPass] = useState("");
  const [newPass2, setNewPass2] = useState("");
  const [showPass, setShowPass] = useState(false);

  const [info, setInfo] = useState(null);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [ticketRules, setTicketRules] = useState(null);
  const [ticketRulesBase, setTicketRulesBase] = useState(null);
  const [showOnlyChanged, setShowOnlyChanged] = useState(false);
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketMsg, setTicketMsg] = useState("");
  const [ticketErr, setTicketErr] = useState("");
  const [questConfirm, setQuestConfirm] = useState(null);
  const [profilePresets, setProfilePresets] = useState([]);
  const [presetAccess, setPresetAccess] = useState(DEFAULT_PRESET_ACCESS);
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetMsg, setPresetMsg] = useState("");
  const [presetErr, setPresetErr] = useState("");

  const { socket } = useSocket();
  const readOnly = useReadOnly();

  const load = useCallback(async () => {
    setErr("");
    try {
      const [jc, si, tr, presets] = await Promise.all([
        api.dmGetJoinCode(),
        api.serverInfo(),
        api.dmTicketsRules(),
        api.dmProfilePresets()
      ]);
      setJoinEnabled(!!jc.enabled);
      setJoinCode(jc.joinCode || "");
      setInfo(si);
      setTicketRules(tr?.rules || null);
      setTicketRulesBase(tr?.rules || null);
      setProfilePresets(Array.isArray(presets?.presets) ? presets.presets : []);
      setPresetAccess(normalizePresetAccess(presets?.access));
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
    }
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch((e) => setErr(formatError(e)));
    const onUpdated = () => load().catch(() => {});
    socket.on("settings:updated", onUpdated);
    return () => {
      socket.off("settings:updated", onUpdated);
    };
  }, [load, socket]);

  const lanUrl = info?.urls?.[0] || (info?.ips?.[0] && info?.port ? `http://${info.ips[0]}:${info.port}` : "");
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
  const filteredGames = showOnlyChanged ? gameEntries.filter(([key, g]) => isGameChanged(ticketBase, key, g)) : gameEntries;
  const filteredShop = showOnlyChanged ? shopEntries.filter(([key, item]) => isShopChanged(ticketBase, key, item)) : shopEntries;

  async function saveJoinCode() {
    if (readOnly) return;
    setMsg("");
    setErr("");
    try {
      const nextCode = joinEnabled ? String(joinCode || "").trim() : "";
      await api.dmSetJoinCode(nextCode);
      setMsg("Код партии сохранён.");
      await load();
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
    }
  }

  async function changePassword() {
    if (readOnly) return;
    setMsg("");
    setErr("");
    const pass = String(newPass || "");
    if (!pass) {
      setErr("Введите новый пароль.");
      return;
    }
    if (pass !== String(newPass2 || "")) {
      setErr("Пароли не совпадают.");
      return;
    }
    try {
      await api.dmChangePassword(pass);
      setMsg("Пароль изменён.");
      setNewPass("");
      setNewPass2("");
      setShowPass(false);
    } catch (e) {
      setErr(formatError(e));
    }
  }

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

  function updateDailyQuest(idx, patch) {
    const pool = [...(ticketRules?.dailyQuest?.pool || [])];
    if (!pool[idx]) return;
    pool[idx] = { ...pool[idx], ...(patch || {}) };
    updateTicketRules({ dailyQuest: { pool } });
  }

  function removeDailyQuest(idx) {
    const pool = [...(ticketRules?.dailyQuest?.pool || [])];
    const removed = pool.splice(idx, 1)[0];
    let activeKey = ticketRules?.dailyQuest?.activeKey || "";
    if (removed?.key && removed.key === activeKey) {
      activeKey = pool.find((q) => q.enabled !== false)?.key || pool[0]?.key || "";
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
    if (readOnly) return;
    if (!ticketRules) return;
    setTicketErr("");
    setTicketMsg("");
    setTicketBusy(true);
    try {
      const r = await api.dmTicketsUpdateRules({
        enabled: ticketRules.enabled ?? true,
        rules: ticketRules
      });
      setTicketRules(r.rules || null);
      setTicketRulesBase(r.rules || null);
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
      const r = await api.dmTicketsUpdateRules({ reset: true });
      setTicketRules(r.rules || null);
      setTicketRulesBase(r.rules || null);
      setTicketMsg("Правила сброшены к дефолту.");
    } catch (e) {
      setTicketErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED));
    } finally {
      setTicketBusy(false);
    }
  }

  function addPreset() {
    setProfilePresets((prev) => addProfilePresetItem(prev));
  }

  function removePreset(idx) {
    setProfilePresets((prev) => removeProfilePresetItem(prev, idx));
  }

  function updatePreset(idx, patch) {
    setProfilePresets((prev) => updateProfilePresetItem(prev, idx, patch));
  }

  function updatePresetData(idx, patch) {
    setProfilePresets((prev) => updateProfilePresetData(prev, idx, patch));
  }

  async function saveProfilePresets() {
    if (readOnly) return;
    setPresetErr("");
    setPresetMsg("");
    setPresetBusy(true);
    try {
      const r = await api.dmProfilePresetsUpdate({
        presets: profilePresets || [],
        access: presetAccess || {}
      });
      setProfilePresets(Array.isArray(r?.presets) ? r.presets : []);
      setPresetAccess(r?.access || presetAccess);
      setPresetMsg("Пресеты сохранены.");
    } catch (e) {
      setPresetErr(formatError(e));
    } finally {
      setPresetBusy(false);
    }
  }

  async function exportZip() {
    setMsg("");
    setErr("");
    try {
      const blob = await api.exportZip();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `backup_${new Date().toISOString().slice(0, 10)}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      setMsg("Экспорт готов.");
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.EXPORT_FAILED));
    }
  }

  async function importZip(e) {
    if (readOnly) return;
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setMsg("");
    setErr("");
    try {
      await api.importZip(file);
      setMsg("Импорт выполнен.");
    } catch (err2) {
      setErr(formatError(err2, ERROR_CODES.IMPORT_FAILED));
    }
  }

  return {
    joinEnabled,
    setJoinEnabled,
    joinCode,
    setJoinCode,
    showJoin,
    setShowJoin,
    newPass,
    setNewPass,
    newPass2,
    setNewPass2,
    showPass,
    setShowPass,
    msg,
    err,
    ticketRules,
    showOnlyChanged,
    setShowOnlyChanged,
    ticketBusy,
    ticketMsg,
    ticketErr,
    questConfirm,
    closeQuestConfirm,
    profilePresets,
    presetAccess,
    setPresetAccess,
    presetBusy,
    presetMsg,
    presetErr,
    readOnly,
    lanUrl,
    ticketDirty,
    generalChanges,
    showGeneralBlock,
    showGeneralInputs,
    showDailyQuestBlock,
    filteredGames,
    filteredShop,
    saveJoinCode,
    changePassword,
    updateTicketRules,
    addDailyQuest,
    updateDailyQuest,
    removeDailyQuest,
    setActiveDailyQuest,
    resetDailyQuestToday,
    reassignDailyQuestToday,
    confirmDailyQuestAction,
    updateTicketGame,
    updateTicketShop,
    saveTicketRules,
    resetTicketRules,
    addPreset,
    removePreset,
    updatePreset,
    updatePresetData,
    saveProfilePresets,
    exportZip,
    importZip
  };
}
