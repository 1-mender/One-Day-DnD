import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { StatsEditor, StatsView } from "../components/profile/StatsEditor.jsx";
import PolaroidFrame from "../components/vintage/PolaroidFrame.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useReadOnly } from "../hooks/useReadOnly.js";
import {
  applyTicketGamePatch,
  applyTicketRulesPatch,
  applyTicketShopPatch,
  buildGeneralChanges,
  createDailyQuestDraft,
  isDailyQuestChanged,
  isGameChanged,
  isShopChanged
} from "./settings/domain/ticketRulesEditor.js";
import { GAME_LABELS, inp, RULE_TIPS, SHOP_LABELS } from "./settings/domain/settingsConstants.js";

export default function DMSettings() {
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
  const [profilePresets, setProfilePresets] = useState([]);
  const [presetAccess, setPresetAccess] = useState({ enabled: true, playerEdit: true, playerRequest: true, hideLocal: false });
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
      setPresetAccess({
        enabled: presets?.access?.enabled !== false,
        playerEdit: presets?.access?.playerEdit !== false,
        playerRequest: presets?.access?.playerRequest !== false,
        hideLocal: !!presets?.access?.hideLocal
      });
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

  async function resetDailyQuestToday() {
    if (readOnly) return;
    const activeKey = ticketRules?.dailyQuest?.activeKey || "";
    if (!activeKey) {
      setTicketErr("Нет активного daily‑quest.");
      return;
    }
    const ok = window.confirm("Сбросить прогресс daily‑quest на сегодня для всех игроков?");
    if (!ok) return;
    setTicketErr("");
    setTicketMsg("");
    setTicketBusy(true);
    try {
      await api.dmTicketsResetQuest(activeKey);
      setTicketMsg("Daily‑quest сброшен на сегодня.");
    } catch (e) {
      setTicketErr(formatError(e));
    } finally {
      setTicketBusy(false);
    }
  }

  async function reassignDailyQuestToday() {
    if (readOnly) return;
    const activeKey = ticketRules?.dailyQuest?.activeKey || "";
    if (!activeKey) {
      setTicketErr("Нет активного daily‑quest.");
      return;
    }
    const ok = window.confirm("Переназначить daily‑quest на сегодня и применить сразу?");
    if (!ok) return;
    setTicketErr("");
    setTicketMsg("");
    setTicketBusy(true);
    try {
      await api.dmTicketsSetActiveQuest(activeKey);
      setTicketMsg("Daily‑quest переназначен на сегодня.");
      setTicketRulesBase((prev) => (
        prev ? { ...prev, dailyQuest: { ...(prev.dailyQuest || {}), activeKey } } : prev
      ));
    } catch (e) {
      setTicketErr(formatError(e));
    } finally {
      setTicketBusy(false);
    }
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
    setProfilePresets((prev) => ([
      ...(prev || []),
      {
        title: "Новый пресет",
        subtitle: "",
        data: {
          characterName: "",
          classRole: "",
          level: "",
          stats: {},
          bio: "",
          avatarUrl: ""
        }
      }
    ]));
  }

  function removePreset(idx) {
    setProfilePresets((prev) => (prev || []).filter((_, i) => i !== idx));
  }

  function updatePreset(idx, patch) {
    setProfilePresets((prev) => (prev || []).map((p, i) => (i === idx ? { ...p, ...(patch || {}) } : p)));
  }

  function updatePresetData(idx, patch) {
    setProfilePresets((prev) => (prev || []).map((p, i) => (
      i === idx
        ? { ...p, data: { ...(p.data || {}), ...(patch || {}) } }
        : p
    )));
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

  return (
    <div className="card taped">
      <div style={{ fontWeight: 900, fontSize: 20 }}>Settings</div>
      <div className="small">{"\u041a\u043e\u0434 \u043f\u0430\u0440\u0442\u0438\u0438, \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u043e\u0441\u0442\u044c, \u044d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0430, LAN/Firewall."}</div>
      <hr />
      {readOnly ? <div className="badge warn">Read-only: write disabled</div> : null}
      {err && <div className="badge off">{"\u041e\u0448\u0438\u0431\u043a\u0430: "}{err}</div>}
      {msg && <div className="badge ok">{msg}</div>}

      <div className="list">
        <div className="title" style={{ marginTop: 6 }}>{"\u0418\u0433\u0440\u043e\u043a"}</div>
        <div className="card taped">
          <div style={{ fontWeight: 800 }}>{"\u041a\u043e\u0434 \u043f\u0430\u0440\u0442\u0438\u0438 (join-code)"}</div>
          <div className="small">{"\u0415\u0441\u043b\u0438 \u0432\u043a\u043b\u044e\u0447\u0435\u043d \u2014 \u0438\u0433\u0440\u043e\u043a\u0438 \u0432\u0432\u043e\u0434\u044f\u0442 \u043a\u043e\u0434 \u043f\u0440\u0438 \u0432\u0445\u043e\u0434\u0435."}</div>
          <hr />
          <label className="row" style={{ gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={joinEnabled} onChange={(e) => setJoinEnabled(e.target.checked)} disabled={readOnly} />
            <span>{"\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u043a\u043e\u0434 \u043f\u0430\u0440\u0442\u0438\u0438"}</span>
          </label>
          <div className="row" style={{ gap: 8, marginTop: 10, alignItems: "center" }}>
            <input
              type={showJoin ? "text" : "password"}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder={"\u041d\u0430\u043f\u0440\u0438\u043c\u0435\u0440: 1234"}
              style={inp}
              disabled={!joinEnabled}
            />
            <button className="btn secondary" onClick={() => setShowJoin((v) => !v)} disabled={!joinEnabled}>
              {showJoin ? "\u0421\u043a\u0440\u044b\u0442\u044c" : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c"}
            </button>
            <button className="btn" onClick={saveJoinCode} disabled={readOnly}>{"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"}</button>
          </div>
        </div>

        <div className="card taped">
          <div style={{ fontWeight: 800 }}>{"\u041f\u0440\u0435\u0441\u0435\u0442\u044b \u043f\u0440\u043e\u0444\u0438\u043b\u044f"}</div>
          <div className="small">{"\u0428\u0430\u0431\u043b\u043e\u043d\u044b \u043f\u0440\u043e\u0444\u0438\u043b\u044f \u0434\u043b\u044f \u0438\u0433\u0440\u043e\u043a\u043e\u0432."}</div>
          <hr />
          {presetErr ? <div className="badge off">{"\u041e\u0448\u0438\u0431\u043a\u0430: "}{presetErr}</div> : null}
          {presetMsg ? <div className="badge ok">{presetMsg}</div> : null}
          <div className="list">
            <label className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={presetAccess.enabled !== false}
                onChange={(e) => setPresetAccess({ ...presetAccess, enabled: e.target.checked })}
              />
              <span>{"\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u043f\u0440\u0435\u0441\u0435\u0442\u044b \u0434\u043b\u044f \u0438\u0433\u0440\u043e\u043a\u043e\u0432"}</span>
            </label>
            <label className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={presetAccess.playerEdit !== false}
                onChange={(e) => setPresetAccess({ ...presetAccess, playerEdit: e.target.checked })}
              />
              <span>{"\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0432 \u043f\u0440\u044f\u043c\u043e\u043c \u0440\u0435\u0434\u0430\u043a\u0442\u0438\u0440\u043e\u0432\u0430\u043d\u0438\u0438"}</span>
            </label>
            <label className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={presetAccess.playerRequest !== false}
                onChange={(e) => setPresetAccess({ ...presetAccess, playerRequest: e.target.checked })}
              />
              <span>{"\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u044c \u043f\u0440\u0438\u043c\u0435\u043d\u0435\u043d\u0438\u0435 \u0432 \u0437\u0430\u043f\u0440\u043e\u0441\u0430\u0445"}</span>
            </label>
            <label className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!presetAccess.hideLocal}
                onChange={(e) => setPresetAccess({ ...presetAccess, hideLocal: e.target.checked })}
              />
              <span>{"\u0421\u043a\u0440\u044b\u0442\u044c \u043b\u043e\u043a\u0430\u043b\u044c\u043d\u044b\u0435 \u043f\u0440\u0435\u0441\u0435\u0442\u044b (\u0442\u043e\u043b\u044c\u043a\u043e DM)"}</span>
            </label>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn secondary" onClick={addPreset} disabled={readOnly}>+ {"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c \u043f\u0440\u0435\u0441\u0435\u0442"}</button>
              <button className="btn" onClick={saveProfilePresets} disabled={readOnly || presetBusy}>{"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"}</button>
            </div>

            {profilePresets.length === 0 ? (
              <div className="badge warn">{"\u041f\u0440\u0435\u0441\u0435\u0442\u043e\u0432 \u043f\u043e\u043a\u0430 \u043d\u0435\u0442."}</div>
            ) : (
              <div className="list">
                {profilePresets.map((preset, idx) => (
                  <div key={preset.id || `${preset.title}-${idx}`} className="paper-note">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div className="title">{"\u041f\u0440\u0435\u0441\u0435\u0442 #"}{idx + 1}</div>
                      <button className="btn danger" onClick={() => removePreset(idx)} disabled={readOnly}>{"\u0423\u0434\u0430\u043b\u0438\u0442\u044c"}</button>
                    </div>
                    <div className="list" style={{ marginTop: 10 }}>
                      <input
                        value={preset.title || ""}
                        onChange={(e) => updatePreset(idx, { title: e.target.value })}
                        placeholder={"\u041d\u0430\u0437\u0432\u0430\u043d\u0438\u0435 \u043f\u0440\u0435\u0441\u0435\u0442\u0430"}
                        maxLength={80}
                        style={inp}
                      />
                      <input
                        value={preset.subtitle || ""}
                        onChange={(e) => updatePreset(idx, { subtitle: e.target.value })}
                        placeholder={"\u041f\u043e\u0434\u0437\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a / \u043e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"}
                        maxLength={160}
                        style={inp}
                      />
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <input
                          value={preset.data?.characterName || ""}
                          onChange={(e) => updatePresetData(idx, { characterName: e.target.value })}
                          placeholder={"\u0418\u043c\u044f \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u0436\u0430"}
                          maxLength={80}
                          style={{ ...inp, minWidth: 220 }}
                        />
                        <input
                          value={preset.data?.classRole || ""}
                          onChange={(e) => updatePresetData(idx, { classRole: e.target.value })}
                          placeholder={"\u041a\u043b\u0430\u0441\u0441 / \u0440\u043e\u043b\u044c"}
                          maxLength={80}
                          style={{ ...inp, minWidth: 220 }}
                        />
                        <input
                          value={preset.data?.level ?? ""}
                          onChange={(e) => updatePresetData(idx, { level: e.target.value })}
                          placeholder={"\u0423\u0440\u043e\u0432\u0435\u043d\u044c"}
                          style={{ ...inp, minWidth: 140 }}
                        />
                      </div>
                      <div className="kv">
                        <div className="title">{"\u0421\u0442\u0430\u0442\u044b"}</div>
                        <StatsEditor value={preset.data?.stats || {}} onChange={(stats) => updatePresetData(idx, { stats })} readOnly={readOnly} />
                      </div>
                      <div className="paper-note" style={{ marginTop: 8 }}>
                        <div className="title">{"\u041f\u0440\u0435\u0432\u044c\u044e"}</div>
                        <div className="row" style={{ alignItems: "flex-start", marginTop: 10 }}>
                          <PolaroidFrame
                            className="sm"
                            src={preset.data?.avatarUrl || ""}
                            alt={preset.data?.characterName || preset.title}
                            fallback={(preset.data?.characterName || preset.title || "?").slice(0, 1)}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900 }}>{preset.data?.characterName || "\u0411\u0435\u0437 \u0438\u043c\u0435\u043d\u0438"}</div>
                            <div className="small" style={{ marginTop: 4 }}>
                              {preset.data?.classRole || "\u041a\u043b\u0430\u0441\u0441/\u0440\u043e\u043b\u044c"} • lvl {preset.data?.level || "?"}
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <StatsView stats={preset.data?.stats || {}} />
                        </div>
                        <div className="small bio-text" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                          {preset.data?.bio || "\u0411\u0438\u043e\u0433\u0440\u0430\u0444\u0438\u044f \u043d\u0435 \u0437\u0430\u043f\u043e\u043b\u043d\u0435\u043d\u0430"}
                        </div>
                      </div>
                      <textarea
                        value={preset.data?.bio || ""}
                        onChange={(e) => updatePresetData(idx, { bio: e.target.value })}
                        rows={5}
                        maxLength={2000}
                        placeholder={"\u0411\u0438\u043e\u0433\u0440\u0430\u0444\u0438\u044f"}
                        style={inp}
                      />
                      <input
                        value={preset.data?.avatarUrl || ""}
                        onChange={(e) => updatePresetData(idx, { avatarUrl: e.target.value })}
                        placeholder={"URL \u0430\u0432\u0430\u0442\u0430\u0440\u0430"}
                        maxLength={512}
                        style={inp}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="title" style={{ marginTop: 10 }}>{"\u0414\u041c"}</div>
        <div className="card taped">
          <div style={{ fontWeight: 800 }}>{"\u0421\u043c\u0435\u043d\u0430 \u043f\u0430\u0440\u043e\u043b\u044f DM"}</div>
          <div className="small">{"\u0420\u0435\u043a\u043e\u043c\u0435\u043d\u0434\u0443\u0435\u0442\u0441\u044f \u0441\u043c\u0435\u043d\u0438\u0442\u044c \u043f\u0430\u0440\u043e\u043b\u044c \u043f\u043e\u0441\u043b\u0435 \u043f\u0435\u0440\u0432\u043e\u0433\u043e \u0437\u0430\u043f\u0443\u0441\u043a\u0430."}</div>
          <hr />
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <input
              type={showPass ? "text" : "password"}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder={"\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c"}
              style={inp}
            />
            <input
              type={showPass ? "text" : "password"}
              value={newPass2}
              onChange={(e) => setNewPass2(e.target.value)}
              placeholder={"\u041f\u043e\u0432\u0442\u043e\u0440\u0438\u0442\u0435 \u043f\u0430\u0440\u043e\u043b\u044c"}
              style={inp}
            />
            <button className="btn secondary" onClick={() => setShowPass((v) => !v)}>
              {showPass ? "\u0421\u043a\u0440\u044b\u0442\u044c" : "\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c"}
            </button>
            <button className="btn" onClick={changePassword} disabled={readOnly}>{"\u0421\u043c\u0435\u043d\u0438\u0442\u044c"}</button>
          </div>
        </div>

        <div className="card taped">
          <div style={{ fontWeight: 800 }}>LAN / Windows Firewall</div>
          <div className="small">{"\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u0434\u043e\u0441\u0442\u0443\u043f\u043d\u043e\u0441\u0442\u044c \u0441\u0435\u0440\u0432\u0435\u0440\u0430 \u0441 \u0442\u0435\u043b\u0435\u0444\u043e\u043d\u043e\u0432 \u0432 \u0442\u043e\u0439 \u0436\u0435 \u0441\u0435\u0442\u0438."}</div>
          <hr />
          <div className="paper-note" style={{ marginBottom: 10 }}>
            <div className="title">LAN</div>
            <div className="small">{"\u0423\u0431\u0435\u0434\u0438\u0442\u0435\u0441\u044c, \u0447\u0442\u043e \u0432\u0441\u0435 \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430 \u0432 \u043e\u0434\u043d\u043e\u0439 Wi-Fi \u0441\u0435\u0442\u0438 \u0438 \u043e\u0442\u043a\u0440\u044b\u0432\u0430\u044e\u0442 IP \u0441\u0435\u0440\u0432\u0435\u0440\u0430."}</div>
          </div>
          <div className="small" style={{ lineHeight: 1.5 }}>
            <b>{"\u0421\u0441\u044b\u043b\u043a\u0430 \u0434\u043b\u044f \u0438\u0433\u0440\u043e\u043a\u043e\u0432:"}</b> {lanUrl || "\u2014"}<br />
            <b>{"\u0415\u0441\u043b\u0438 \u043d\u0435 \u0437\u0430\u0445\u043e\u0434\u0438\u0442:"}</b>
            <ul style={{ marginTop: 6 }}>
              <li>{"\u0421\u0435\u0440\u0432\u0435\u0440 \u0434\u043e\u043b\u0436\u0435\u043d \u0441\u043b\u0443\u0448\u0430\u0442\u044c 0.0.0.0, \u0430 \u043d\u0435 \u0442\u043e\u043b\u044c\u043a\u043e localhost."}</li>
              <li>{"\u0420\u0430\u0437\u0440\u0435\u0448\u0438\u0442\u0435 \u0434\u043e\u0441\u0442\u0443\u043f \u0432 Firewall \u0434\u043b\u044f Private networks."}</li>
              <li>{"\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 \u043f\u043e\u0440\u0442 \u0438 \u0447\u0442\u043e \u0443\u0441\u0442\u0440\u043e\u0439\u0441\u0442\u0432\u0430 \u0432 \u043e\u0434\u043d\u043e\u0439 \u0441\u0435\u0442\u0438."}</li>
            </ul>
          </div>
        </div>

        <div className="card taped">
          <div style={{ fontWeight: 800 }}>Backup</div>
          <div className="small">{"\u042d\u043a\u0441\u043f\u043e\u0440\u0442/\u0438\u043c\u043f\u043e\u0440\u0442: app.db + uploads/ (zip)"}</div>
          <hr />
          <button className="btn secondary" onClick={exportZip}>{"\u042d\u043a\u0441\u043f\u043e\u0440\u0442 (zip)"}</button>
          <div style={{ marginTop: 10 }}>
            <input type="file" accept=".zip" onChange={importZip} disabled={readOnly} />
          </div>
        </div>

        <div className="title" style={{ marginTop: 10 }}>{"\u042d\u043a\u043e\u043d\u043e\u043c\u0438\u043a\u0430"}</div>
        <div className="card taped">
          <div style={{ fontWeight: 800 }}>{"\u0410\u0440\u043a\u0430\u0434\u0430 \u0438 \u0431\u0438\u043b\u0435\u0442\u044b"}</div>
          <div className="small">{"\u041d\u0430\u0441\u0442\u0440\u043e\u0439\u043a\u0430 \u0438\u0433\u0440, \u043b\u0438\u043c\u0438\u0442\u043e\u0432 \u0438 \u0446\u0435\u043d."}</div>
          <hr />
          <div className="row" style={{ gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            <label className="row" style={{ gap: 6 }} title={RULE_TIPS.showOnlyChanged}>
              <input
                type="checkbox"
                checked={showOnlyChanged}
                onChange={(e) => setShowOnlyChanged(e.target.checked)}
              />
              <span>{"\u041f\u043e\u043a\u0430\u0437\u0430\u0442\u044c \u0442\u043e\u043b\u044c\u043a\u043e \u0438\u0437\u043c\u0435\u043d\u0451\u043d\u043d\u044b\u0435"}</span>
            </label>
            {ticketDirty ? (
              <span className="badge warn">{"\u0415\u0441\u0442\u044c \u043d\u0435\u0441\u043e\u0445\u0440\u0430\u043d\u0451\u043d\u043d\u044b\u0435 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u044f"}</span>
            ) : (
              <span className="badge ok">{"\u0418\u0437\u043c\u0435\u043d\u0435\u043d\u0438\u0439 \u043d\u0435\u0442"}</span>
            )}
            <button className="btn" onClick={saveTicketRules} disabled={readOnly || ticketBusy || !ticketDirty}>
              {"\u0421\u043e\u0445\u0440\u0430\u043d\u0438\u0442\u044c"}
            </button>
            <button className="btn secondary" onClick={resetTicketRules} disabled={readOnly || ticketBusy}>
              {"\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u043a \u0434\u0435\u0444\u043e\u043b\u0442\u0443"}
            </button>
          </div>
          {ticketErr ? <div className="badge off">{"\u041e\u0448\u0438\u0431\u043a\u0430: "}{ticketErr}</div> : null}
          {ticketMsg ? <div className="badge ok">{ticketMsg}</div> : null}
          {!ticketRules ? (
            <div className="badge warn">{"\u0417\u0430\u0433\u0440\u0443\u0437\u043a\u0430 \u043d\u0430\u0441\u0442\u0440\u043e\u0435\u043a..."}</div>
          ) : (
            <div className="list">
              {showGeneralBlock ? (
                <>
                  {!showOnlyChanged || generalChanges.enabled ? (
                    <label className="row" style={{ gap: 10, alignItems: "center" }} title={RULE_TIPS.arcadeEnabled}>
                      <input
                        type="checkbox"
                        checked={ticketRules.enabled !== false}
                        onChange={(e) => updateTicketRules({ enabled: e.target.checked })}
                      />
                      <span>{"\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c \u0430\u0440\u043a\u0430\u0434\u0443 \u0438 \u0431\u0438\u043b\u0435\u0442\u044b"}</span>
                    </label>
                  ) : null}

                  {showGeneralInputs ? (
                    <div className="settings-fields">
                      {!showOnlyChanged || generalChanges.dailyEarnCap ? (
                        <input
                          type="number"
                          min="0"
                          value={ticketRules.dailyEarnCap ?? 0}
                          onChange={(e) => updateTicketRules({ dailyEarnCap: Number(e.target.value) || 0 })}
                          placeholder={"\u0414\u043d\u0435\u0432\u043d\u043e\u0439 \u043b\u0438\u043c\u0438\u0442"}
                          title={RULE_TIPS.dailyEarnCap}
                        />
                      ) : null}
                      {!showOnlyChanged || generalChanges.streakMax ? (
                        <input
                          type="number"
                          min="0"
                          value={ticketRules.streak?.max ?? 0}
                          onChange={(e) => updateTicketRules({ streak: { ...(ticketRules.streak || {}), max: Number(e.target.value) || 0 } })}
                          placeholder={"\u0421\u0435\u0440\u0438\u044f max"}
                          title={RULE_TIPS.streakMax}
                        />
                      ) : null}
                      {!showOnlyChanged || generalChanges.streakStep ? (
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={ticketRules.streak?.step ?? 0}
                          onChange={(e) => updateTicketRules({ streak: { ...(ticketRules.streak || {}), step: Number(e.target.value) || 0 } })}
                          placeholder={"\u0421\u0435\u0440\u0438\u044f \u0448\u0430\u0433"}
                          title={RULE_TIPS.streakStep}
                        />
                      ) : null}
                      {!showOnlyChanged || generalChanges.streakFlatBonus ? (
                        <input
                          type="number"
                          min="0"
                          value={ticketRules.streak?.flatBonus ?? 0}
                          onChange={(e) => updateTicketRules({ streak: { ...(ticketRules.streak || {}), flatBonus: Number(e.target.value) || 0 } })}
                          placeholder={"\u0411\u043e\u043d\u0443\u0441 \u0441\u0435\u0440\u0438\u0438"}
                          title={RULE_TIPS.streakFlatBonus}
                        />
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <div className="badge warn">{"\u041d\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0445 \u043e\u0431\u0449\u0438\u0445 \u043f\u0440\u0430\u0432\u0438\u043b."}</div>
              )}

              {showDailyQuestBlock ? (
                <div className="paper-note">
                  <div className="title">{"Daily quest"}</div>
                  <div className="settings-fields" style={{ marginTop: 8 }}>
                    <label className="row" style={{ gap: 10, alignItems: "center" }} title={RULE_TIPS.dailyQuestEnabled}>
                      <input
                        type="checkbox"
                        checked={ticketRules?.dailyQuest?.enabled !== false}
                        onChange={(e) => updateTicketRules({ dailyQuest: { enabled: e.target.checked } })}
                      />
                      <span>{"\u0412\u043a\u043b\u044e\u0447\u0438\u0442\u044c Daily quest"}</span>
                    </label>
                    <button className="btn secondary" onClick={addDailyQuest}>+ {"\u0414\u043e\u0431\u0430\u0432\u0438\u0442\u044c"}</button>
                    <button className="btn secondary" onClick={resetDailyQuestToday} disabled={readOnly || ticketBusy}>
                      {"\u0421\u0431\u0440\u043e\u0441\u0438\u0442\u044c \u043d\u0430 \u0441\u0435\u0433\u043e\u0434\u043d\u044f"}
                    </button>
                    <button className="btn secondary" onClick={reassignDailyQuestToday} disabled={readOnly || ticketBusy}>
                      {"\u041f\u0435\u0440\u0435\u043d\u0430\u0437\u043d\u0430\u0447\u0438\u0442\u044c \u0441\u0435\u0433\u043e\u0434\u043d\u044f"}
                    </button>
                  </div>

                  <div className="settings-fields" style={{ marginTop: 6 }}>
                    <select
                      value={ticketRules?.dailyQuest?.activeKey || ""}
                      onChange={(e) => setActiveDailyQuest(e.target.value)}
                      title={RULE_TIPS.dailyQuestTitle}
                    >
                      {(ticketRules?.dailyQuest?.pool || []).map((q) => (
                        <option key={q.key} value={q.key}>
                          {q.title || q.key}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="paper-note" style={{ marginTop: 8 }}>
                    <div className="title">{"Превью (игрокам)"}</div>
                    {(() => {
                      const pool = ticketRules?.dailyQuest?.pool || [];
                      const activeKey = ticketRules?.dailyQuest?.activeKey || "";
                      const active = pool.find((q) => q.key === activeKey) || pool[0];
                      if (!active) return <div className="small">{"Нет активного квеста."}</div>;
                      return (
                        <div className="list">
                          <div className="small">{active.title}: {active.description}</div>
                          <div className="row" style={{ gap: 8, flexWrap: "wrap", marginTop: 6 }}>
                            <span className="badge">{"Прогресс: 0/"}{active.goal}</span>
                            <span className="badge secondary">{"Награда: "}{active.reward} {"билета"}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>

                  <div className="settings-grid" style={{ marginTop: 8 }}>
                    {(ticketRules?.dailyQuest?.pool || []).map((q, idx) => (
                      <div key={q.key || idx} className="item settings-card">
                        <div className="settings-head">
                          <div style={{ fontWeight: 800 }}>
                            {q.title || `Quest #${idx + 1}`}
                            {ticketRules?.dailyQuest?.activeKey === q.key ? <span className="badge ok" style={{ marginLeft: 8 }}>active</span> : null}
                          </div>
                          <div className="row" style={{ gap: 8 }}>
                            <label className="row" style={{ gap: 6 }} title={RULE_TIPS.dailyQuestEnabled}>
                              <input
                                type="checkbox"
                                checked={q.enabled !== false}
                                onChange={(e) => updateDailyQuest(idx, { enabled: e.target.checked })}
                              />
                              <span>{"\u0412\u043a\u043b"}</span>
                            </label>
                            <button className="btn danger" onClick={() => removeDailyQuest(idx)}>{"\u0423\u0434\u0430\u043b\u0438\u0442\u044c"}</button>
                          </div>
                        </div>
                        <div className="settings-fields">
                          <input
                            value={q.title || ""}
                            onChange={(e) => updateDailyQuest(idx, { title: e.target.value })}
                            placeholder={"\u0417\u0430\u0433\u043e\u043b\u043e\u0432\u043e\u043a"}
                            maxLength={80}
                            title={RULE_TIPS.dailyQuestTitle}
                          />
                          <input
                            value={q.description || ""}
                            onChange={(e) => updateDailyQuest(idx, { description: e.target.value })}
                            placeholder={"\u041e\u043f\u0438\u0441\u0430\u043d\u0438\u0435"}
                            maxLength={160}
                            title={RULE_TIPS.dailyQuestDescription}
                          />
                          <input
                            type="number"
                            min="1"
                            value={q.goal ?? 2}
                            onChange={(e) => updateDailyQuest(idx, { goal: Number(e.target.value) || 1 })}
                            placeholder={"\u0426\u0435\u043b\u044c"}
                            title={RULE_TIPS.dailyQuestGoal}
                          />
                          <input
                            type="number"
                            min="0"
                            value={q.reward ?? 0}
                            onChange={(e) => updateDailyQuest(idx, { reward: Number(e.target.value) || 0 })}
                            placeholder={"\u041d\u0430\u0433\u0440\u0430\u0434\u0430"}
                            title={RULE_TIPS.dailyQuestReward}
                          />
                        </div>
                        <div className="settings-sub">key: {q.key || "—"}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="paper-note">
                <div className="title">{"\u0418\u0433\u0440\u044b"}</div>
                <div className="settings-grid" style={{ marginTop: 8 }}>
                  {showOnlyChanged && filteredGames.length === 0 ? (
                    <div className="badge warn">{"\u041d\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0445 \u043f\u0440\u0430\u0432\u0438\u043b \u0434\u043b\u044f \u0438\u0433\u0440."}</div>
                  ) : (
                    filteredGames.map(([key, g]) => (
                      <div key={key} className="item settings-card">
                        <div className="settings-head">
                          <div style={{ fontWeight: 800 }}>{GAME_LABELS[key] || key}</div>
                          <label className="row" style={{ gap: 6 }} title={RULE_TIPS.gameEnabled}>
                            <input
                              type="checkbox"
                              checked={g.enabled !== false}
                              onChange={(e) => updateTicketGame(key, { enabled: e.target.checked })}
                            />
                            <span>{"\u0412\u043a\u043b"}</span>
                          </label>
                        </div>
                        <div className="settings-fields">
                          <input
                            type="number"
                            min="0"
                            value={g.entryCost ?? 0}
                            onChange={(e) => updateTicketGame(key, { entryCost: Number(e.target.value) || 0 })}
                            placeholder={"\u0412\u0445\u043e\u0434"}
                            title={RULE_TIPS.entryCost}
                          />
                          <input
                            type="number"
                            min="0"
                            value={g.rewardMin ?? 0}
                            onChange={(e) => updateTicketGame(key, { rewardMin: Number(e.target.value) || 0 })}
                            placeholder={"\u041c\u0438\u043d"}
                            title={RULE_TIPS.rewardMin}
                          />
                          <input
                            type="number"
                            min="0"
                            value={g.rewardMax ?? 0}
                            onChange={(e) => updateTicketGame(key, { rewardMax: Number(e.target.value) || 0 })}
                            placeholder={"\u041c\u0430\u043a\u0441"}
                            title={RULE_TIPS.rewardMax}
                          />
                          <input
                            type="number"
                            min="0"
                            value={g.lossPenalty ?? 0}
                            onChange={(e) => updateTicketGame(key, { lossPenalty: Number(e.target.value) || 0 })}
                            placeholder={"\u0428\u0442\u0440\u0430\u0444"}
                            title={RULE_TIPS.lossPenalty}
                          />
                          <input
                            type="number"
                            min="0"
                            value={g.dailyLimit ?? 0}
                            onChange={(e) => updateTicketGame(key, { dailyLimit: Number(e.target.value) || 0 })}
                            placeholder={"\u041b\u0438\u043c\u0438\u0442/\u0434\u0435\u043d\u044c"}
                            title={RULE_TIPS.dailyLimit}
                          />
                        </div>
                        <div className="settings-fields">
                          <input
                            value={g.ui?.difficulty ?? ""}
                            onChange={(e) => updateTicketGame(key, { ui: { difficulty: e.target.value } })}
                            placeholder={"\u0421\u043b\u043e\u0436\u043d\u043e\u0441\u0442\u044c"}
                            maxLength={40}
                            title={RULE_TIPS.uiDifficulty}
                          />
                          <input
                            value={g.ui?.risk ?? ""}
                            onChange={(e) => updateTicketGame(key, { ui: { risk: e.target.value } })}
                            placeholder={"\u0420\u0438\u0441\u043a"}
                            maxLength={40}
                            title={RULE_TIPS.uiRisk}
                          />
                          <input
                            value={g.ui?.time ?? ""}
                            onChange={(e) => updateTicketGame(key, { ui: { time: e.target.value } })}
                            placeholder={"\u0412\u0440\u0435\u043c\u044f"}
                            maxLength={40}
                            title={RULE_TIPS.uiTime}
                          />
                        </div>
                        <div className="settings-sub">{"\u041d\u0430\u0433\u0440\u0430\u0434\u0430 \u0438 \u0448\u0442\u0440\u0430\u0444\u044b \u0437\u0430\u0434\u0430\u044e\u0442 \u0434\u0438\u0430\u043f\u0430\u0437\u043e\u043d \u0431\u0438\u043b\u0435\u0442\u043e\u0432."}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="paper-note">
                <div className="title">{"\u0418\u043d\u0432\u0435\u043d\u0442\u0430\u0440\u044c (\u043c\u0430\u0433\u0430\u0437\u0438\u043d)"}</div>
                <div className="settings-grid" style={{ marginTop: 8 }}>
                  {showOnlyChanged && filteredShop.length === 0 ? (
                    <div className="badge warn">{"\u041d\u0435\u0442 \u0438\u0437\u043c\u0435\u043d\u0435\u043d\u043d\u044b\u0445 \u043f\u0440\u0430\u0432\u0438\u043b \u0434\u043b\u044f \u043c\u0430\u0433\u0430\u0437\u0438\u043d\u0430."}</div>
                  ) : (
                    filteredShop.map(([key, item]) => (
                      <div key={key} className="item settings-card">
                        <div className="settings-head">
                          <div style={{ fontWeight: 800 }}>{SHOP_LABELS[key] || key}</div>
                          <label className="row" style={{ gap: 6 }} title={RULE_TIPS.shopEnabled}>
                            <input
                              type="checkbox"
                              checked={item.enabled !== false}
                              onChange={(e) => updateTicketShop(key, { enabled: e.target.checked })}
                            />
                            <span>{"\u0412\u043a\u043b"}</span>
                          </label>
                        </div>
                        <div className="settings-fields">
                          <input
                            type="number"
                            min="0"
                            value={item.price ?? 0}
                            onChange={(e) => updateTicketShop(key, { price: Number(e.target.value) || 0 })}
                            placeholder={"\u0426\u0435\u043d\u0430"}
                            title={RULE_TIPS.shopPrice}
                          />
                          <input
                            type="number"
                            min="0"
                            value={item.dailyLimit ?? 0}
                            onChange={(e) => updateTicketShop(key, { dailyLimit: Number(e.target.value) || 0 })}
                            placeholder={"\u041b\u0438\u043c\u0438\u0442/\u0434\u0435\u043d\u044c"}
                            title={RULE_TIPS.shopDailyLimit}
                          />
                        </div>
                        <div className="settings-sub">{"\u041b\u0438\u043c\u0438\u0442 0 = \u0431\u0435\u0437 \u043e\u0433\u0440\u0430\u043d\u0438\u0447\u0435\u043d\u0438\u044f."}</div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
