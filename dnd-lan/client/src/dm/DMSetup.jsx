import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";

export default function DMSetup() {
  const nav = useNavigate();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");

  useEffect(() => {
    api.serverInfo().then((r) => {
      if (r.hasDm) nav("/dm", { replace: true });
    }).catch(()=>{});
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      await api.dmSetup(username, password);
      await api.dmLogin(username, password);
      nav("/dm/app/dashboard", { replace: true });
    } catch (e2) {
      setErr(e2.body?.error || e2.message);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 22 }}>Первый запуск — создать DM</div>
        <div className="small">Рекомендуется пароль от 6+ символов.</div>
        <hr />
        <form className="list" onSubmit={submit}>
          <input value={username} onChange={(e)=>setUsername(e.target.value)} placeholder="username" style={inp} />
          <input value={password} onChange={(e)=>setPassword(e.target.value)} placeholder="password (>=6)" type="password" style={inp} />
          {err && <div className="badge off">Ошибка: {err}</div>}
          <button className="btn" type="submit">Создать</button>
        </form>
      </div>
    </div>
  );
}
const inp = { padding: 10, borderRadius: 12, border: "1px solid #1f2a3a", background:"#0b0f14", color:"#e7eef7", width:"100%" };
