import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, storage } from "../api.js";
import VintageShell from "../components/vintage/VintageShell.jsx";

export default function Join() {
  const nav = useNavigate();
  const [displayName, setDisplayName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [info, setInfo] = useState(null);
  const [err, setErr] = useState("");

  useEffect(() => {
    api.serverInfo().then(setInfo).catch((e) => setErr(e?.body?.error || e.message || "offline"));
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
    <VintageShell layout="spread">
      <div className="container">
        <div className="spread-grid">
          <div className="spread-col">
            <div className="card taped panel scrap-card paper-stack">
              <div style={{ fontWeight: 800, fontSize: 20 }}>Подключиться к партии</div>
              <div className="paper-note" style={{ marginTop: 8 }}>
                {info?.party?.name ? `Партия: ${info.party.name}` : "Загрузка…"}
              </div>
              <hr />
              <form onSubmit={submit} className="list">
                <div className="kv">
                  <div>Имя игрока/персонажа *</div>
                  <input value={displayName} onChange={(e)=>setDisplayName(e.target.value)} placeholder="Напр. Aria / Bob" style={{ width: "100%" }} />
                </div>
                {info?.party?.joinCodeEnabled && (
                  <div className="kv">
                    <div>Код партии</div>
                    <input value={joinCode} onChange={(e)=>setJoinCode(e.target.value)} placeholder="Если включён DM" style={{ width: "100%" }} />
                  </div>
                )}
                {err && <div className="badge off">Ошибка: {err}</div>}
                <button className="btn" type="submit">Отправить заявку</button>
              </form>
            </div>
          </div>

          <div className="spread-col">
            <div className="card taped scrap-card">
              <div style={{ fontWeight: 800 }}>Как подключиться</div>
              <div className="small">Короткая памятка для игроков</div>
              <hr />
              <div className="list">
                <div className="item">
                  <div className="kv">
                    <div style={{ fontWeight: 700 }}>1. Откройте адрес сервера</div>
                    <div className="small">{info?.urls?.[0] || "Адрес выдаст мастер"}</div>
                  </div>
                </div>
                <div className="item">
                  <div className="kv">
                    <div style={{ fontWeight: 700 }}>2. Введите имя</div>
                    <div className="small">Можно имя игрока или персонажа</div>
                  </div>
                </div>
                <div className="item">
                  <div className="kv">
                    <div style={{ fontWeight: 700 }}>3. Код партии (если нужен)</div>
                    <div className="small">Запросите у мастера, если включено</div>
                  </div>
                </div>
              </div>
              <div className="paper-note" style={{ marginTop: 10 }}>
                <div className="title">Совет</div>
                <div className="small">Если не открывается — проверьте Wi‑Fi сеть и повторите.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </VintageShell>
  );
}
