import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useSocket } from "../context/SocketContext.jsx";
import { useReadOnly } from "../hooks/useReadOnly.js";
import { formatError } from "../lib/formatError.js";
import { RefreshCcw, Send } from "lucide-react";

const REFRESH_MS = 30_000;

export default function Transfers() {
  const nav = useNavigate();
  const toast = useToast();
  const readOnly = useReadOnly();
  const { socket } = useSocket();

  const [err, setErr] = useState("");
  const [inbox, setInbox] = useState([]);
  const [outbox, setOutbox] = useState([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [outboxLoading, setOutboxLoading] = useState(true);
  const [inboxQ, setInboxQ] = useState("");
  const [outboxQ, setOutboxQ] = useState("");

  const loadInbox = useCallback(async () => {
    setInboxLoading(true);
    try {
      const response = await api.invTransferInbox();
      setInbox(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      setErr(formatError(error));
      setInbox([]);
    } finally {
      setInboxLoading(false);
    }
  }, []);

  const loadOutbox = useCallback(async () => {
    setOutboxLoading(true);
    try {
      const response = await api.invTransferOutbox();
      setOutbox(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      setErr(formatError(error));
      setOutbox([]);
    } finally {
      setOutboxLoading(false);
    }
  }, []);

  const loadAll = useCallback(async () => {
    setErr("");
    await Promise.all([loadInbox(), loadOutbox()]);
  }, [loadInbox, loadOutbox]);

  useEffect(() => {
    loadAll().catch(() => {});
  }, [loadAll]);

  useEffect(() => {
    if (!socket) return () => {};
    const onTransfers = () => loadAll().catch(() => {});
    socket.on("transfers:updated", onTransfers);
    return () => {
      socket.off("transfers:updated", onTransfers);
    };
  }, [loadAll, socket]);

  useEffect(() => {
    const id = setInterval(() => {
      loadAll().catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [loadAll]);

  async function acceptTransfer(transfer) {
    if (readOnly) return;
    setErr("");
    try {
      const response = await api.invTransferAccept(transfer.id);
      if (response?.status === "expired") {
        toast.warn("Передача истекла");
      } else {
        toast.success("Передача принята");
      }
      await loadAll();
    } catch (error) {
      const message = formatError(error);
      setErr(message);
      toast.error(message);
    }
  }

  async function rejectTransfer(transfer) {
    if (readOnly) return;
    setErr("");
    try {
      const response = await api.invTransferReject(transfer.id);
      if (response?.status === "expired") {
        toast.warn("Передача истекла");
      } else {
        toast.success("Передача отклонена");
      }
      await loadAll();
    } catch (error) {
      const message = formatError(error);
      setErr(message);
      toast.error(message);
    }
  }

  async function cancelTransfer(transfer) {
    if (readOnly) return;
    setErr("");
    try {
      const response = await api.invTransferCancel(transfer.id);
      if (response?.status === "expired") {
        toast.warn("Передача истекла");
      } else {
        toast.success("Передача отменена");
      }
      await loadAll();
    } catch (error) {
      const message = formatError(error);
      setErr(message);
      toast.error(message);
    }
  }

  const inboxFiltered = useMemo(() => filterTransfers(inbox, inboxQ), [inbox, inboxQ]);
  const outboxFiltered = useMemo(() => filterTransfers(outbox, outboxQ), [outbox, outboxQ]);

  return (
    <div className="card inventory-shell">
      <div className="inv-header">
        <div className="inv-header-main">
          <div className="inv-title-lg">Передачи</div>
          <div className="inv-subtitle">
            Входящие: {inbox.length} • Исходящие: {outbox.length}
            {readOnly ? <span className="badge warn">read-only</span> : null}
          </div>
        </div>
        <div className="inv-header-actions">
          <button className="btn secondary" onClick={() => nav("/app/inventory")}>К инвентарю</button>
          <button className="btn secondary" onClick={loadAll}>
            <RefreshCcw className="icon" aria-hidden="true" />Обновить
          </button>
        </div>
      </div>

      <ErrorBanner message={err} onRetry={loadAll} />

      <div className="inv-transfer-grid">
        <div className="inv-panel inv-transfer">
          <div className="inv-panel-head">
            <div className="inv-panel-title">Входящие передачи</div>
            <span className="badge secondary">{inboxLoading ? "..." : inbox.length}</span>
          </div>
          <input
            value={inboxQ}
            onChange={(event) => setInboxQ(event.target.value)}
            placeholder="Поиск во входящих..."
          />
          <div className="inv-panel-body">
            {inboxLoading ? (
              <Skeleton h={90} w="100%" />
            ) : inboxFiltered.length === 0 ? (
              <EmptyState
                title={inbox.length ? "Ничего не найдено" : "Нет входящих передач"}
                hint={inbox.length ? "Измените поисковый запрос." : "Когда игрок отправит предмет, он появится здесь."}
              />
            ) : (
              <div className="list">
                {inboxFiltered.map((transfer) => (
                  <TransferItem
                    key={transfer.id}
                    transfer={transfer}
                    side="inbox"
                    readOnly={readOnly}
                    onAccept={() => acceptTransfer(transfer)}
                    onReject={() => rejectTransfer(transfer)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="inv-panel inv-transfer">
          <div className="inv-panel-head">
            <div className="inv-panel-title">Исходящие передачи</div>
            <span className="badge secondary">{outboxLoading ? "..." : outbox.length}</span>
          </div>
          <input
            value={outboxQ}
            onChange={(event) => setOutboxQ(event.target.value)}
            placeholder="Поиск в исходящих..."
          />
          <div className="inv-panel-body">
            {outboxLoading ? (
              <Skeleton h={90} w="100%" />
            ) : outboxFiltered.length === 0 ? (
              <EmptyState
                title={outbox.length ? "Ничего не найдено" : "Нет исходящих передач"}
                hint={outbox.length ? "Измените поисковый запрос." : "Создайте передачу из карточки предмета в инвентаре."}
              />
            ) : (
              <div className="list">
                {outboxFiltered.map((transfer) => (
                  <TransferItem
                    key={transfer.id}
                    transfer={transfer}
                    side="outbox"
                    readOnly={readOnly}
                    onCancel={() => cancelTransfer(transfer)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function TransferItem({ transfer, side, readOnly, onAccept, onReject, onCancel }) {
  const expired = Number(transfer.expiresAt || 0) > 0 && Number(transfer.expiresAt) <= Date.now();
  return (
    <div className="item" style={{ alignItems: "flex-start" }}>
      <div style={{ flex: 1 }}>
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          {expired ? <span className="badge secondary">Истекла</span> : null}
          {side === "inbox" ? (
            <span className="badge secondary">от {transfer.fromName || `#${transfer.fromPlayerId}`}</span>
          ) : (
            <span className="badge secondary">кому {transfer.toName || `#${transfer.toPlayerId}`}</span>
          )}
          <span className="badge">x{transfer.qty}</span>
          <span className="small">{new Date(transfer.createdAt).toLocaleString()}</span>
        </div>
        <div className="small" style={{ marginTop: 6 }}>
          Предмет: <b>{transfer.itemName || `#${transfer.itemId}`}</b>
        </div>
        {transfer.note ? (
          <div className="small" style={{ marginTop: 6 }}>
            <b>Сообщение:</b> {transfer.note}
          </div>
        ) : null}
      </div>
      {side === "inbox" ? (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn" onClick={onAccept} disabled={readOnly}>
            <Send className="icon" aria-hidden="true" />Принять
          </button>
          <button className="btn secondary" onClick={onReject} disabled={readOnly}>
            Отклонить
          </button>
        </div>
      ) : (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn secondary" onClick={onCancel} disabled={readOnly}>
            Отменить
          </button>
        </div>
      )}
    </div>
  );
}

function filterTransfers(list, q) {
  const items = Array.isArray(list) ? list : [];
  const qq = String(q || "").toLowerCase().trim();
  if (!qq) return items;
  return items.filter((transfer) => {
    const hay = [
      transfer.itemName,
      transfer.toName,
      transfer.fromName,
      transfer.note,
      String(transfer.toPlayerId || ""),
      String(transfer.fromPlayerId || "")
    ].filter(Boolean).join(" ").toLowerCase();
    return hay.includes(qq);
  });
}

