import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";

export default function DMSetup() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [setupSecret, setSetupSecret] = useState("");
  const [err, setErr] = useState("");
  const [netErr, setNetErr] = useState("");

  useEffect(() => {
    api.serverInfo().then((r) => {
      setNetErr("");
      if (r.hasDm) nav("/dm", { replace: true });
    }).catch((e) => setNetErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED)));
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.dmSetup(username, password, setupSecret);
      await api.dmLogin(username, password);
      nav("/dm/app/dashboard", { replace: true });
    } catch (e2) {
      setErr(formatError(e2));
    }
  }

  return (
    <VintageShell>
      <div className="container">
        <div className="card taped panel">
          <div style={{ fontWeight: 900, fontSize: 22 }}>Первый запуск: создайте аккаунт DM</div>
          <div className="small">Используйте надёжный пароль длиной не менее 6 символов.</div>
          <hr />
          <form className="list" onSubmit={submit}>
            <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="Логин" style={{ width: "100%" }} />
            <input value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="Пароль (минимум 6 символов)" type="password" style={{ width: "100%" }} />
            <input
              value={setupSecret}
              onChange={(e)=>setSetupSecret(e.target.value)}
              placeholder="Setup secret (необязательно)"
              style={{ width: "100%" }}
            />
            {err && <div className="badge off">Ошибка: {err}</div>}
            {netErr && <div className="badge off">Сеть: {netErr}</div>}
            <button className="btn" type="submit">Создать</button>
          </form>
        </div>
      </div>
    </VintageShell>
  );
}
