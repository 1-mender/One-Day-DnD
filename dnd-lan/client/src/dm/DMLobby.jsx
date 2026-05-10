import React, { useCallback, useEffect, useState } from "react";
import { api } from "../api.js";
import { formatError } from "../lib/formatError.js";
import { useSocket } from "../context/SocketContext.jsx";
import { useReadOnly } from "../hooks/useReadOnly.js";

export default function DMLobby() {
  const [items, setItems] = useState([]);
  const [err, setErr] = useState("");
  const { socket } = useSocket();
  const readOnly = useReadOnly();

  const load = useCallback(async () => {
    const r = await api.dmRequests();
    setItems(r.items || []);
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onJoin = () => load().catch(() => {});
    socket.on("player:joinRequested", onJoin);
    return () => {
      socket.off("player:joinRequested", onJoin);
    };
  }, [load, socket]);

  async function approve(id) {
    if (readOnly) return;
    setErr("");
    try { await api.dmApprove(id); await load(); } catch (e) { setErr(formatError(e)); }
  }
  async function reject(id) {
    if (readOnly) return;
    setErr("");
    try { await api.dmReject(id); await load(); } catch (e) { setErr(formatError(e)); }
  }
  async function ban(id) {
    if (readOnly) return;
    setErr("");
    try { await api.dmBan(id); await load(); } catch (e) { setErr(formatError(e)); }
  }

  const uniqueIpCount = new Set(items.map((item) => item.ip).filter(Boolean)).size;
  const oldestRequest = items.length
    ? [...items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at))[0]
    : null;

  return (
    <div className="spread-grid dm-lobby-grid">
      <div className="spread-col">
        <div className="card taped scrap-card paper-stack tf-shell tf-dm-lobby-shell">
          <div className="tf-page-head">
            <div className="tf-page-head-main">
              <div className="tf-overline">Join requests</div>
              <div className="tf-page-title">Лобби / Подключения</div>
              <div className="small">Заявки на вход: принять / отклонить / заблокировать IP</div>
            </div>
          </div>
          <hr />
          {readOnly ? <div className="badge warn">Режим только чтения: изменения отключены</div> : null}
          {err && <div className="badge off">Ошибка: {err}</div>}
          <div className="dm-lobby-summary tf-stat-grid">
            <div className="tf-stat-card">
              <div className="small">Заявок</div>
              <strong>{items.length}</strong>
            </div>
            <div className="tf-stat-card">
              <div className="small">IP адресов</div>
              <strong>{uniqueIpCount}</strong>
            </div>
            <div className="tf-stat-card">
              <div className="small">Самая ранняя</div>
              <strong>{oldestRequest ? new Date(oldestRequest.created_at).toLocaleTimeString() : "—"}</strong>
            </div>
          </div>
          <div className="list dm-lobby-list">
            {items.length === 0 ? (
              <div className="paper-note dm-lobby-empty">
                <div className="title">Нет заявок</div>
                <div className="small">Когда игроки попросят вход, здесь появятся карточки с именем, временем, IP и быстрыми действиями.</div>
              </div>
            ) : null}
            {items.map((r) => (
              <div key={r.id} className="item taped dm-lobby-item">
                <div className="kv">
                  <div style={{ fontWeight: 800 }}>{r.display_name}</div>
                  <div className="small">{new Date(r.created_at).toLocaleTimeString()} • {r.ip || "ip?"}</div>
                  <div className="small">{(r.user_agent || "").slice(0, 80)}</div>
                </div>
                <div className="row" style={{ gap: 8 }}>
                  <button className="btn" onClick={() => approve(r.id)} disabled={readOnly}>Принять</button>
                  <button className="btn secondary" onClick={() => reject(r.id)} disabled={readOnly}>Отклонить</button>
                  <button className="btn danger" onClick={() => ban(r.id)} disabled={readOnly}>Заблок.</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="spread-col">
        <div className="card taped scrap-card tf-panel tf-dm-lobby-guide">
          <div className="tf-section-copy">
            <div className="tf-section-kicker">Moderation guide</div>
            <div style={{ fontWeight: 800 }}>Памятка</div>
          </div>
          <div className="small">Короткий сценарий действий по входящим заявкам.</div>
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
          <div className="paper-note dm-lobby-note" style={{ marginTop: 10 }}>
            <div className="title">Совет</div>
            <div className="small">Если видишь повторяющиеся IP или странные имена, сначала отклоняй, а бан используй уже для явного мусора.</div>
          </div>
        </div>
      </div>
    </div>
  );
}
