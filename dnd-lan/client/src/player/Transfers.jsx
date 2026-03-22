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
import { ChevronDown, RefreshCcw, Send } from "lucide-react";

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
  const [inboxOpen, setInboxOpen] = useState(true);
  const [outboxOpen, setOutboxOpen] = useState(false);
  const [autoRefreshPaused, setAutoRefreshPaused] = useState(false);

  const loadInbox = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setInboxLoading(true);
    try {
      const response = await api.invTransferInbox();
      setInbox(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      if (!silent) {
        setErr(formatError(error));
        setInbox([]);
      }
    } finally {
      if (!silent) setInboxLoading(false);
    }
  }, []);

  const loadOutbox = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setOutboxLoading(true);
    try {
      const response = await api.invTransferOutbox();
      setOutbox(Array.isArray(response?.items) ? response.items : []);
    } catch (error) {
      if (!silent) {
        setErr(formatError(error));
        setOutbox([]);
      }
    } finally {
      if (!silent) setOutboxLoading(false);
    }
  }, []);

  const loadAll = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setErr("");
    await Promise.all([loadInbox({ silent }), loadOutbox({ silent })]);
  }, [loadInbox, loadOutbox]);

  useEffect(() => {
    loadAll().catch(() => {});
  }, [loadAll]);

  useEffect(() => {
    if (!socket) return () => {};
    const onTransfers = () => loadAll({ silent: true }).catch(() => {});
    socket.on("transfers:updated", onTransfers);
    return () => {
      socket.off("transfers:updated", onTransfers);
    };
  }, [loadAll, socket]);

  useEffect(() => {
    const updateAutoRefreshState = () => {
      const hidden = typeof document !== "undefined" && document.visibilityState === "hidden";
      const typing = isEditingInput();
      const keyboardOpen = isKeyboardOpen();
      const poorNetwork = isPoorNetwork();
      setAutoRefreshPaused(hidden || typing || keyboardOpen || poorNetwork);
    };

    const connection = getNetworkConnection();
    updateAutoRefreshState();
    document.addEventListener("visibilitychange", updateAutoRefreshState);
    document.addEventListener("focusin", updateAutoRefreshState);
    document.addEventListener("focusout", updateAutoRefreshState);
    window.addEventListener("resize", updateAutoRefreshState);
    window.visualViewport?.addEventListener("resize", updateAutoRefreshState);
    connection?.addEventListener?.("change", updateAutoRefreshState);

    return () => {
      document.removeEventListener("visibilitychange", updateAutoRefreshState);
      document.removeEventListener("focusin", updateAutoRefreshState);
      document.removeEventListener("focusout", updateAutoRefreshState);
      window.removeEventListener("resize", updateAutoRefreshState);
      window.visualViewport?.removeEventListener("resize", updateAutoRefreshState);
      connection?.removeEventListener?.("change", updateAutoRefreshState);
    };
  }, []);

  useEffect(() => {
    if (autoRefreshPaused) return () => {};
    const id = setInterval(() => {
      loadAll({ silent: true }).catch(() => {});
    }, REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefreshPaused, loadAll]);

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
      await loadAll({ silent: true });
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
      await loadAll({ silent: true });
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
      await loadAll({ silent: true });
    } catch (error) {
      const message = formatError(error);
      setErr(message);
      toast.error(message);
    }
  }

  const inboxFiltered = useMemo(() => filterTransfers(inbox, inboxQ), [inbox, inboxQ]);
  const outboxFiltered = useMemo(() => filterTransfers(outbox, outboxQ), [outbox, outboxQ]);

  useEffect(() => {
    if (String(inboxQ || "").trim()) setInboxOpen(true);
  }, [inboxQ]);

  useEffect(() => {
    if (String(outboxQ || "").trim()) setOutboxOpen(true);
  }, [outboxQ]);

  useEffect(() => {
    if (!inboxLoading && inbox.length === 0 && !String(inboxQ || "").trim()) setInboxOpen(false);
  }, [inboxLoading, inbox.length, inboxQ]);

  useEffect(() => {
    if (!outboxLoading && outbox.length === 0 && !String(outboxQ || "").trim()) setOutboxOpen(false);
  }, [outboxLoading, outbox.length, outboxQ]);

  return (
    <div className="card inventory-shell tf-shell tf-transfers-shell">
      <div className="inv-header">
        <div className="inv-header-main">
          <div className="tf-overline">Item relay</div>
          <div className="inv-title-lg tf-page-title">Передачи</div>
          <div className="inv-subtitle">
            Входящие: {inbox.length} • Исходящие: {outbox.length}
            {readOnly ? <span className="badge warn">только чтение</span> : null}
            <span className={`badge ${autoRefreshPaused ? "secondary" : "ok"}`.trim()}>
              {autoRefreshPaused ? "Автообновление на паузе" : "Автообновление"}
            </span>
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
        <div className={`inv-panel inv-transfer inv-accordion${inboxOpen ? " open" : ""}`.trim()}>
          <div className="inv-panel-head">
            <button
              type="button"
              className="inv-accordion-toggle"
              onClick={() => setInboxOpen((prev) => !prev)}
              aria-expanded={inboxOpen ? "true" : "false"}
              aria-controls="transfer-inbox-body"
            >
              <span className="inv-panel-title">Входящие передачи</span>
              <ChevronDown className="icon" aria-hidden="true" />
            </button>
            <span className="badge secondary" aria-label={`Входящие: ${inboxLoading ? "загрузка" : inbox.length}`}>
              {inboxLoading ? "..." : inbox.length}
            </span>
          </div>
          <div className="inv-accordion-body" data-open={inboxOpen ? "true" : "false"} id="transfer-inbox-body">
            <div className="inv-accordion-content">
              <input
                value={inboxQ}
                onChange={(event) => setInboxQ(event.target.value)}
                placeholder="Поиск во входящих..."
                aria-label="Поиск во входящих передачах"
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
          </div>
        </div>

        <div className={`inv-panel inv-transfer inv-accordion${outboxOpen ? " open" : ""}`.trim()}>
          <div className="inv-panel-head">
            <button
              type="button"
              className="inv-accordion-toggle"
              onClick={() => setOutboxOpen((prev) => !prev)}
              aria-expanded={outboxOpen ? "true" : "false"}
              aria-controls="transfer-outbox-body"
            >
              <span className="inv-panel-title">Исходящие передачи</span>
              <ChevronDown className="icon" aria-hidden="true" />
            </button>
            <span className="badge secondary" aria-label={`Исходящие: ${outboxLoading ? "загрузка" : outbox.length}`}>
              {outboxLoading ? "..." : outbox.length}
            </span>
          </div>
          <div className="inv-accordion-body" data-open={outboxOpen ? "true" : "false"} id="transfer-outbox-body">
            <div className="inv-accordion-content">
              <input
                value={outboxQ}
                onChange={(event) => setOutboxQ(event.target.value)}
                placeholder="Поиск в исходящих..."
                aria-label="Поиск в исходящих передачах"
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
      </div>
    </div>
  );
}

function TransferItem({ transfer, side, readOnly, onAccept, onReject, onCancel }) {
  const expired = Number(transfer.expiresAt || 0) > 0 && Number(transfer.expiresAt) <= Date.now();
  return (
    <div className="item tf-transfer-item" style={{ alignItems: "flex-start" }}>
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
          <button className="btn" onClick={onAccept} disabled={readOnly || expired}>
            <Send className="icon" aria-hidden="true" />Принять
          </button>
          <button className="btn secondary" onClick={onReject} disabled={readOnly || expired}>
            Отклонить
          </button>
        </div>
      ) : (
        <div className="row" style={{ gap: 8, flexWrap: "wrap" }}>
          <button className="btn secondary" onClick={onCancel} disabled={readOnly || expired}>
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

function isEditingInput() {
  if (typeof document === "undefined") return false;
  const active = document.activeElement;
  if (!active || !(active instanceof HTMLElement)) return false;
  const tag = String(active.tagName || "").toLowerCase();
  return (
    tag === "input"
    || tag === "textarea"
    || tag === "select"
    || !!active.isContentEditable
  );
}

function isKeyboardOpen() {
  if (typeof window === "undefined") return false;
  const viewport = window.visualViewport;
  if (!viewport) return false;
  return window.innerHeight - viewport.height > 120;
}

function getNetworkConnection() {
  if (typeof navigator === "undefined") return null;
  return navigator.connection || navigator.mozConnection || navigator.webkitConnection || null;
}

function isPoorNetwork() {
  const connection = getNetworkConnection();
  if (!connection) return false;
  const effectiveType = String(connection.effectiveType || "").toLowerCase();
  if (connection.saveData) return true;
  if (effectiveType === "slow-2g" || effectiveType === "2g") return true;
  const downlink = Number(connection.downlink);
  return Number.isFinite(downlink) && downlink > 0 && downlink < 1;
}
