import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api.js";
import { connectSocket } from "../socket.js";
import { formatError } from "../lib/formatError.js";

export default function DMLobby() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const socket = useMemo(() => connectSocket({ role: "dm" }), []);

  const load = useCallback(async () => {
    const r = await api.dmRequests();
    setItems(r.items || []);
  }, []);

  useEffect(() => {
    load().catch(() => {});
    socket.on("player:joinRequested", () => load().catch(() => {}));
    return () => socket.disconnect();
  }, [load, socket]);

  async function approve(id) {
    setErr("");
    try { await api.dmApprove(id); await load(); } catch (e) { setErr(formatError(e)); }
  }
  async function reject(id) {
    setErr("");
    try { await api.dmReject(id); await load(); } catch (e) { setErr(formatError(e)); }
  }
  async function ban(id) {
    setErr("");
    try { await api.dmBan(id); await load(); } catch (e) { setErr(formatError(e)); }
  }

  return (
    <div className="spread-grid">
      <div className="spread-col">
        <div className="card taped scrap-card paper-stack">
          <div style={{ fontWeight: 900, fontSize: 20 }}>Лобби / Подключения</div>
          <div className="small">Заявки на вход: принять / отклонить / заблокировать IP</div>
          <hr />
          {err && <div className="badge off">Ошибка: {err}</div>}
          <div className="list">
            {items.length === 0 && <div className="badge warn">Нет заявок</div>}
            {items.map((r) => (
              <div key={r.id} className="item taped">
                <div className="kv">
                  <div style={{ fontWeight: 800 }}>{r.display_name}</div>
                  <div className="small">{new Date(r.created_at).toLocaleTimeString()} • {r.ip || "ip?"}</div>
                  <div className="small">{(r.user_agent || "").slice(0, 80)}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={() => approve(r.id)}>Принять</button>
                  <button className="btn secondary" onClick={() => reject(r.id)}>Отклонить</button>
                  <button className="btn danger" onClick={() => ban(r.id)}>Заблок.</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="spread-col">
        <div className="card taped scrap-card">
          <div style={{ fontWeight: 800 }}>Памятка</div>
          <div className="small">Быстрые правила по модерации</div>
          <hr />
          <div className="list">
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>Принять</div>
                <div className="small">Добавляет игрока в партию</div>
              </div>
            </div>
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>Отклонить</div>
                <div className="small">Только отклоняет заявку</div>
              </div>
            </div>
            <div className="item">
              <div className="kv">
                <div style={{ fontWeight: 700 }}>Заблокировать</div>
                <div className="small">Блокирует IP запроса</div>
              </div>
            </div>
          </div>
          <div className="paper-note" style={{ marginTop: 10 }}>
            <div className="title">Совет</div>
            <div className="small">Если заявок много — сортируйте по времени.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
