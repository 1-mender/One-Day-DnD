import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, storage } from "../api.js";

export default function Join() {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.serverInfo().then(setInfo).catch(() => {});
    // if already has token -> go app
    if (storage.getPlayerToken()) nav("/app", { replace: true });
  }, []);

  async function submit(e) {
    e.preventDefault();
    setErr("");
    try {
      const r = await api.joinRequest(displayName, joinCode);
      storage.setJoinRequestId(r.joinRequestId);
      nav("/waiting", { replace: true });
    } catch (e2) {
      setErr(e2.body?.error || e2.message);
    }
  }

  return (
    <div className="container">
      <div className="card">
        <div style={{ fontWeight: 800, fontSize: 20 }}>Подключиться к партии</div>
        <div className="small" style={{ marginTop: 6 }}>
          {info?.party?.name ? `Партия: ${info.party.name}` : "Загрузка…"}
        </div>
        <hr />
        <form onSubmit={submit} className="list">
          <div className="kv">
            <div>Имя игрока/персонажа *</div>
            <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Напр. Aria / Bob" style={{ padding: 10, borderRadius: 12, border: "1px solid #1f2a3a", background:"#0b0f14", color:"#e7eef7" }} />
          </div>
          {info?.party?.joinCodeEnabled && (
            <div className="kv">
              <div>Код партии</div>
              <input value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="Если включён DM" style={{ padding: 10, borderRadius: 12, border: "1px solid #1f2a3a", background:"#0b0f14", color:"#e7eef7" }} />
            </div>
          )}
          {err && <div className="badge off">Ошибка: {err}</div>}
          <button className="btn" type="submit">Отправить заявку</button>
        </form>
      </div>
    </div>
  );
}
