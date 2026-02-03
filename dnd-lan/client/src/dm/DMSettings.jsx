import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { connectSocket } from "../socket.js";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";
import { StatsEditor, StatsView } from "../components/profile/StatsEditor.jsx";
import PolaroidFrame from "../components/vintage/PolaroidFrame.jsx";

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
  const [ticketBusy, setTicketBusy] = useState(false);
  const [ticketMsg, setTicketMsg] = useState("");
  const [ticketErr, setTicketErr] = useState("");
  const [profilePresets, setProfilePresets] = useState([]);
  const [presetAccess, setPresetAccess] = useState({ enabled: true, playerEdit: true, playerRequest: true, hideLocal: false });
  const [presetBusy, setPresetBusy] = useState(false);
  const [presetMsg, setPresetMsg] = useState("");
  const [presetErr, setPresetErr] = useState("");

  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

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
    load().catch((e) => setErr(formatError(e)));
    socket.on("settings:updated", () => load().catch(() => {}));
    return () => socket.disconnect();
  }, [load, socket]);

  async function saveJoinCode() {
    setMsg("");
    setErr("");
    try {
      if (!joinEnabled) {
        await api.dmSetJoinCode("");
        setMsg("Код партии отключён.");
        return;
      }
      const code = joinCode.trim();
      if (!code) {
        setErr("Введите код или отключите переключатель.");
        return;
      }
      await api.dmSetJoinCode(code);
      setMsg("Код партии сохранён.");
    } catch (e) {
      setErr(formatError(e));
    }
  }

  async function changePassword() {
    setMsg("");
    setErr("");
    try {
      const p1 = newPass.trim();
      const p2 = newPass2.trim();
      if (p1.length < 6) return setErr("Пароль должен быть минимум 6 символов.");
      if (p1 !== p2) return setErr("Пароли не совпадают.");
      await api.dmChangePassword(p1);
      setNewPass("");
      setNewPass2("");
      setMsg("Пароль DM успешно изменён.");
    } catch (e) {
      setErr(formatError(e));
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
      a.download = "dnd-lan-backup.zip";
      a.click();
      URL.revokeObjectURL(url);
      setMsg("Экспорт готов.");
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.EXPORT_FAILED));
    }
  }

  async function importZip(e) {
    setMsg("");
    setErr("");
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      await api.importZip(file);
      setMsg("Импорт выполнен. Клиентам обновить страницу (если нужно).");
    } catch (e) {
      setErr(formatError(e, ERROR_CODES.IMPORT_FAILED));
    } finally {
      e.target.value = "";
    }
  }

  function updateTicketRules(patch) {
    setTicketRules((cur) => {
      if (!cur) return cur;
      return { ...cur, ...patch };
    });
  }

  function updateTicketGame(gameKey, patch) {
    setTicketRules((cur) => {
      if (!cur) return cur;
      return {
        ...cur,
        games: {
          ...(cur.games || {}),
          [gameKey]: { ...(cur.games?.[gameKey] || {}), ...patch }
        }
      };
    });
  }

  function updateTicketShop(itemKey, patch) {
    setTicketRules((cur) => {
      if (!cur) return cur;
      return {
        ...cur,
        shop: {
          ...(cur.shop || {}),
          [itemKey]: { ...(cur.shop?.[itemKey] || {}), ...patch }
        }
      };
    });
  }

  function updatePreset(idx, patch) {
    setProfilePresets((cur) => cur.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  }

  function updatePresetData(idx, patch) {
    setProfilePresets((cur) => cur.map((p, i) => (
      i === idx ? { ...p, data: { ...(p.data || {}), ...patch } } : p
    )));
  }

  function addPreset() {
    const id = `preset_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
    setProfilePresets((cur) => [
      ...cur,
      {
        id,
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
    ]);
  }

  function removePreset(idx) {
    setProfilePresets((cur) => cur.filter((_, i) => i !== idx));
  }

  async function saveProfilePresets() {
    setPresetMsg("");
    setPresetErr("");
    setPresetBusy(true);
    try {
      const r = await api.dmProfilePresetsUpdate({ presets: profilePresets, access: presetAccess });
      setProfilePresets(Array.isArray(r?.presets) ? r.presets : profilePresets);
      setPresetAccess(r?.access || presetAccess);
      setPresetMsg("Пресеты сохранены.");
    } catch (e) {
      setPresetErr(formatError(e));
    } finally {
      setPresetBusy(false);
    }
  }

  async function saveTicketRules() {
    if (!ticketRules) return;
    setTicketMsg("");
    setTicketErr("");
    setTicketBusy(true);
    try {
      const r = await api.dmTicketsUpdateRules({ rules: ticketRules });
      setTicketRules(r?.rules || ticketRules);
      setTicketMsg("Настройки игр сохранены.");
    } catch (e) {
      setTicketErr(formatError(e));
    } finally {
      setTicketBusy(false);
    }
  }

  async function resetTicketRules() {
    setTicketMsg("");
    setTicketErr("");
    setTicketBusy(true);
    try {
      const r = await api.dmTicketsUpdateRules({ reset: true });
      setTicketRules(r?.rules || ticketRules);
      setTicketMsg("Сброшено до значений по умолчанию.");
    } catch (e) {
      setTicketErr(formatError(e));
    } finally {
      setTicketBusy(false);
    }
  }

  const lanUrl = info?.urls?.[0] || (info?.ips?.[0] && info?.port ? `http://${info.ips[0]}:${info.port}` : "");

  return (
    <div className="card taped">
      <div style={{ fontWeight: 900, fontSize: 20 }}>Settings</div>
      <div className="small">Код партии, безопасность, подсказки LAN/Firewall</div>
      <hr />
      {err && <div className="badge off">Ошибка: {err}</div>}
      {msg && <div className="badge ok">{msg}</div>}

      <div className="list">
        <div className="card taped">
          <div style={{ fontWeight: 800 }}>Код партии (join-code)</div>
          <div className="small">Если включён — игроки должны ввести код на экране подключения.</div>
          <hr />
          <label className="row" style={{ gap: 10, alignItems: "center" }}>
            <input type="checkbox" checked={joinEnabled} onChange={(e) => setJoinEnabled(e.target.checked)} />
            <span>Включить код партии</span>
          </label>
          <div className="row" style={{ gap: 8, marginTop: 10, alignItems: "center" }}>
            <input
              type={showJoin ? "text" : "password"}
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              placeholder="Например: 1234"
              style={inp}
              disabled={!joinEnabled}
            />
            <button className="btn secondary" onClick={() => setShowJoin((v) => !v)} disabled={!joinEnabled}>
              {showJoin ? "Скрыть" : "Показать"}
            </button>
            <button className="btn" onClick={saveJoinCode}>Сохранить</button>
          </div>
        </div>

        <div className="card taped">
          <div style={{ fontWeight: 800 }}>Смена пароля DM</div>
          <div className="small">Рекомендуется сменить пароль сразу после первого запуска.</div>
          <hr />
          <div className="row" style={{ gap: 8, alignItems: "center" }}>
            <input
              type={showPass ? "text" : "password"}
              value={newPass}
              onChange={(e) => setNewPass(e.target.value)}
              placeholder="Новый пароль"
              style={inp}
            />
            <input
              type={showPass ? "text" : "password"}
              value={newPass2}
              onChange={(e) => setNewPass2(e.target.value)}
              placeholder="Повторите пароль"
              style={inp}
            />
            <button className="btn secondary" onClick={() => setShowPass((v) => !v)}>
              {showPass ? "Скрыть" : "Показать"}
            </button>
            <button className="btn" onClick={changePassword}>Сменить</button>
          </div>
        </div>

        <div className="card taped">
          <div style={{ fontWeight: 800 }}>Аркада и билеты</div>
          <div className="small">Настройка игр, лимитов и цен. Сохраняется для всей партии.</div>
          <hr />
          {ticketErr ? <div className="badge off">Ошибка: {ticketErr}</div> : null}
          {ticketMsg ? <div className="badge ok">{ticketMsg}</div> : null}
          {!ticketRules ? (
            <div className="badge warn">Загрузка настроек...</div>
          ) : (
            <div className="list">
              <label className="row" style={{ gap: 10, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={ticketRules.enabled !== false}
                  onChange={(e) => updateTicketRules({ enabled: e.target.checked })}
                />
                <span>Включить аркаду и билеты</span>
              </label>

              <div className="settings-fields">
                <input
                  type="number"
                  min="0"
                  value={ticketRules.dailyEarnCap ?? 0}
                  onChange={(e) => updateTicketRules({ dailyEarnCap: Number(e.target.value) || 0 })}
                  placeholder="Дневной лимит"
                />
                <input
                  type="number"
                  min="0"
                  value={ticketRules.streak?.max ?? 0}
                  onChange={(e) => updateTicketRules({ streak: { ...(ticketRules.streak || {}), max: Number(e.target.value) || 0 } })}
                  placeholder="Серия max"
                />
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={ticketRules.streak?.step ?? 0}
                  onChange={(e) => updateTicketRules({ streak: { ...(ticketRules.streak || {}), step: Number(e.target.value) || 0 } })}
                  placeholder="Серия шаг"
                />
                <input
                  type="number"
                  min="0"
                  value={ticketRules.streak?.flatBonus ?? 0}
                  onChange={(e) => updateTicketRules({ streak: { ...(ticketRules.streak || {}), flatBonus: Number(e.target.value) || 0 } })}
                  placeholder="Бонус серии"
                />
              </div>

              <div className="paper-note">
                <div className="title">Игры</div>
                <div className="settings-grid" style={{ marginTop: 8 }}>
                  {Object.entries(ticketRules.games || {}).map(([key, g]) => (
                    <div key={key} className="item settings-card">
                      <div className="settings-head">
                        <div style={{ fontWeight: 800 }}>{GAME_LABELS[key] || key}</div>
                        <label className="row" style={{ gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={g.enabled !== false}
                            onChange={(e) => updateTicketGame(key, { enabled: e.target.checked })}
                          />
                          <span>Вкл</span>
                        </label>
                      </div>
                      <div className="settings-fields">
                        <input
                          type="number"
                          min="0"
                          value={g.entryCost ?? 0}
                          onChange={(e) => updateTicketGame(key, { entryCost: Number(e.target.value) || 0 })}
                          placeholder="Вход"
                        />
                        <input
                          type="number"
                          min="0"
                          value={g.rewardMin ?? 0}
                          onChange={(e) => updateTicketGame(key, { rewardMin: Number(e.target.value) || 0 })}
                          placeholder="Мин"
                        />
                        <input
                          type="number"
                          min="0"
                          value={g.rewardMax ?? 0}
                          onChange={(e) => updateTicketGame(key, { rewardMax: Number(e.target.value) || 0 })}
                          placeholder="Макс"
                        />
                        <input
                          type="number"
                          min="0"
                          value={g.lossPenalty ?? 0}
                          onChange={(e) => updateTicketGame(key, { lossPenalty: Number(e.target.value) || 0 })}
                          placeholder="Штраф"
                        />
                        <input
                          type="number"
                          min="0"
                          value={g.dailyLimit ?? 0}
                          onChange={(e) => updateTicketGame(key, { dailyLimit: Number(e.target.value) || 0 })}
                          placeholder="Лимит/день"
                        />
                      </div>
                      <div className="settings-sub">Награда и штрафы задают диапазон билетов.</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="paper-note">
                <div className="title">Магазин</div>
                <div className="settings-grid" style={{ marginTop: 8 }}>
                  {Object.entries(ticketRules.shop || {}).map(([key, item]) => (
                    <div key={key} className="item settings-card">
                      <div className="settings-head">
                        <div style={{ fontWeight: 800 }}>{SHOP_LABELS[key] || key}</div>
                        <label className="row" style={{ gap: 6 }}>
                          <input
                            type="checkbox"
                            checked={item.enabled !== false}
                            onChange={(e) => updateTicketShop(key, { enabled: e.target.checked })}
                          />
                          <span>Вкл</span>
                        </label>
                      </div>
                      <div className="settings-fields">
                        <input
                          type="number"
                          min="0"
                          value={item.price ?? 0}
                          onChange={(e) => updateTicketShop(key, { price: Number(e.target.value) || 0 })}
                          placeholder="Цена"
                        />
                        <input
                          type="number"
                          min="0"
                          value={item.dailyLimit ?? 0}
                          onChange={(e) => updateTicketShop(key, { dailyLimit: Number(e.target.value) || 0 })}
                          placeholder="Лимит/день"
                        />
                      </div>
                      <div className="settings-sub">Лимит 0 = без ограничения.</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                <button className="btn" onClick={saveTicketRules} disabled={ticketBusy}>Сохранить</button>
                <button className="btn secondary" onClick={resetTicketRules} disabled={ticketBusy}>Сброс</button>
              </div>
            </div>
          )}
        </div>

        <div className="card taped">
          <div style={{ fontWeight: 800 }}>Пресеты профиля</div>
          <div className="small">Глобальные шаблоны для игроков: можно включать/выключать и давать доступ.</div>
          <hr />
          {presetErr ? <div className="badge off">Ошибка: {presetErr}</div> : null}
          {presetMsg ? <div className="badge ok">{presetMsg}</div> : null}
          <div className="list">
            <label className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={presetAccess.enabled !== false}
                onChange={(e) => setPresetAccess({ ...presetAccess, enabled: e.target.checked })}
              />
              <span>Включить пресеты для игроков</span>
            </label>
            <label className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={presetAccess.playerEdit !== false}
                onChange={(e) => setPresetAccess({ ...presetAccess, playerEdit: e.target.checked })}
              />
              <span>Разрешить применение в прямом редактировании</span>
            </label>
            <label className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={presetAccess.playerRequest !== false}
                onChange={(e) => setPresetAccess({ ...presetAccess, playerRequest: e.target.checked })}
              />
              <span>Разрешить применение в запросах</span>
            </label>
            <label className="row" style={{ gap: 10, alignItems: "center" }}>
              <input
                type="checkbox"
                checked={!!presetAccess.hideLocal}
                onChange={(e) => setPresetAccess({ ...presetAccess, hideLocal: e.target.checked })}
              />
              <span>Скрыть локальные пресеты (только DM)</span>
            </label>

            <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
              <button className="btn secondary" onClick={addPreset}>+ Добавить пресет</button>
              <button className="btn" onClick={saveProfilePresets} disabled={presetBusy}>Сохранить</button>
            </div>

            {profilePresets.length === 0 ? (
              <div className="badge warn">Пресетов пока нет.</div>
            ) : (
              <div className="list">
                {profilePresets.map((preset, idx) => (
                  <div key={preset.id || `${preset.title}-${idx}`} className="paper-note">
                    <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                      <div className="title">Пресет #{idx + 1}</div>
                      <button className="btn danger" onClick={() => removePreset(idx)}>Удалить</button>
                    </div>
                    <div className="list" style={{ marginTop: 10 }}>
                      <input
                        value={preset.title || ""}
                        onChange={(e) => updatePreset(idx, { title: e.target.value })}
                        placeholder="Название пресета"
                        maxLength={80}
                        style={inp}
                      />
                      <input
                        value={preset.subtitle || ""}
                        onChange={(e) => updatePreset(idx, { subtitle: e.target.value })}
                        placeholder="Подзаголовок/описание"
                        maxLength={160}
                        style={inp}
                      />
                      <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
                        <input
                          value={preset.data?.characterName || ""}
                          onChange={(e) => updatePresetData(idx, { characterName: e.target.value })}
                          placeholder="Имя персонажа"
                          maxLength={80}
                          style={{ ...inp, minWidth: 220 }}
                        />
                        <input
                          value={preset.data?.classRole || ""}
                          onChange={(e) => updatePresetData(idx, { classRole: e.target.value })}
                          placeholder="Класс / роль"
                          maxLength={80}
                          style={{ ...inp, minWidth: 220 }}
                        />
                        <input
                          value={preset.data?.level ?? ""}
                          onChange={(e) => updatePresetData(idx, { level: e.target.value })}
                          placeholder="Уровень"
                          style={{ ...inp, minWidth: 140 }}
                        />
                      </div>
                      <div className="kv">
                        <div className="title">Статы</div>
                        <StatsEditor value={preset.data?.stats || {}} onChange={(stats) => updatePresetData(idx, { stats })} />
                      </div>
                      <div className="paper-note" style={{ marginTop: 8 }}>
                        <div className="title">Превью</div>
                        <div className="row" style={{ alignItems: "flex-start", marginTop: 10 }}>
                          <PolaroidFrame
                            className="sm"
                            src={preset.data?.avatarUrl || ""}
                            alt={preset.data?.characterName || preset.title}
                            fallback={(preset.data?.characterName || preset.title || "?").slice(0, 1)}
                          />
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 900 }}>{preset.data?.characterName || "Без имени"}</div>
                            <div className="small" style={{ marginTop: 4 }}>
                              {preset.data?.classRole || "Класс/роль"} • lvl {preset.data?.level || "?"}
                            </div>
                          </div>
                        </div>
                        <div style={{ marginTop: 10 }}>
                          <StatsView stats={preset.data?.stats || {}} />
                        </div>
                        <div className="small bio-text" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                          {preset.data?.bio || "Биография не заполнена"}
                        </div>
                      </div>
                      <textarea
                        value={preset.data?.bio || ""}
                        onChange={(e) => updatePresetData(idx, { bio: e.target.value })}
                        rows={5}
                        maxLength={2000}
                        placeholder="Биография"
                        style={inp}
                      />
                      <input
                        value={preset.data?.avatarUrl || ""}
                        onChange={(e) => updatePresetData(idx, { avatarUrl: e.target.value })}
                        placeholder="URL аватара"
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

        <div className="card taped">
          <div style={{ fontWeight: 800 }}>LAN / Windows Firewall</div>
          <div className="small">Проверьте доступность сервера с телефонов в той же сети.</div>
          <hr />
          <div className="paper-note" style={{ marginBottom: 10 }}>
            <div className="title">LAN подсказка</div>
            <div className="small">Убедитесь, что все устройства в одной Wi‑Fi сети (LAN) и открывают адрес сервера по IP.</div>
          </div>
          <div className="small" style={{ lineHeight: 1.5 }}>
            <b>Ссылка для игроков:</b> {lanUrl || "—"}<br />
            <b>Если телефоны не заходят:</b>
            <ul style={{ marginTop: 6 }}>
              <li>Проверьте, что сервер слушает <b>0.0.0.0</b> (а не только localhost).</li>
              <li>Windows 11: при первом запуске разрешите доступ в <b>Firewall</b> для <b>Private networks</b>.</li>
              <li>Проверьте порт (по умолчанию 3000) и что устройства в одной сети.</li>
            </ul>
          </div>
        </div>

        <div className="card taped">
          <div style={{ fontWeight: 800 }}>Backup</div>
          <div className="small">Экспорт/импорт: app.db + uploads/ (zip)</div>
          <hr />
          <button className="btn secondary" onClick={exportZip}>Экспорт (zip)</button>
          <div style={{ marginTop: 10 }}>
            <input type="file" accept=".zip" onChange={importZip} />
          </div>
        </div>
      </div>
    </div>
  );
}
const inp = { width: "100%" };

const GAME_LABELS = {
  ttt: "Крестики-нолики",
  guess: "Угадай карту",
  match3: "Три в ряд",
  uno: "Uno-мини",
  scrabble: "Эрудит-блиц"
};

const SHOP_LABELS = {
  stat: "+1 к характеристике",
  feat: "Памятка-талант",
  reroll: "Переброс кубика",
  luck: "Печать удачи",
  chest: "Сундук-сюрприз",
  hint: "Тайная подсказка"
};
