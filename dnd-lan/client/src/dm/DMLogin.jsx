import React, { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { api } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";
import { formatError } from "../lib/formatError.js";
import { ERROR_CODES } from "../lib/errorCodes.js";

export default function DMLogin() {
  const nav = useNavigate();
  const [info, setInfo] = useState(null);
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [netErr, setNetErr] = useState("");

  useEffect(() => {
    api.serverInfo().then((r) => {
      setNetErr("");
      setInfo(r);
      if (!r.hasDm) nav("/dm/setup", { replace: true });
    }).catch((e) => setNetErr(formatError(e, ERROR_CODES.SERVER_INFO_FAILED)));
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
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
          <div style={{ fontWeight: 900, fontSize: 22 }}>DM Login</div>
          <div className="small">Локальный доступ. Пароль хранится хешированно.</div>
          <hr />
          <form className="list" onSubmit={submit}>
            <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="username" style={{ width: "100%" }} />
            <input value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="password" type="password" style={{ width: "100%" }} />
            {err && <div className="badge off">Ошибка: {err}</div>}
            {netErr && <div className="badge off">Сеть: {netErr}</div>}
            <button className="btn" type="submit">Войти</button>
            {!info?.hasDm && <div className="small">Нет DM? <Link to="/dm/setup">Настроить</Link></div>}
          </form>
        </div>
      </div>
    </VintageShell>
  );
}
