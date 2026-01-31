import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { connectSocket } from "../socket.js";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";

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

  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  const load = useCallback(async () => {
    setErr("");
    try {
      const [jc, si] = await Promise.all([api.dmGetJoinCode(), api.serverInfo()]);
      setJoinEnabled(!!jc.enabled);
      setJoinCode(jc.joinCode || "");
      setInfo(si);
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
