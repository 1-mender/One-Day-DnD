import { Copy, RefreshCcw } from "lucide-react";
import { EmptyState, Skeleton } from "../../../foundation/primitives/index.js";
import {
  DM_PROFILE_FIELD_LABELS,
  formatProfileRequestValue
} from "../playerProfileAdminDomain.js";

export default function DMPlayerProfileRequestsTab({ controller }) {
  const {
    applyFromRequest,
    approve,
    loadRequests,
    playerRequests,
    readOnly,
    reject,
    reqLoading,
    reqStatus,
    requestNotes,
    requestsRef,
    setReqStatus,
    setRequestNotes
  } = controller;

  return (
    <div className="list" id="dm-requests-panel">
      <div className="row u-row-wrap">
        <div className="small">Фильтр запросов:</div>
        {[
          ["pending", "В ожидании"],
          ["approved", "Одобрено"],
          ["rejected", "Отклонено"],
          ["all", "Все"]
        ].map(([status, label]) => (
          <button
            key={status}
            className={`btn ${reqStatus === status ? "" : "secondary"}`}
            onClick={() => setReqStatus(status)}
          >
            {label}
          </button>
        ))}
        <button className="btn secondary" onClick={loadRequests}>
          <RefreshCcw className="icon" aria-hidden="true" />Обновить
        </button>
      </div>

      {reqLoading ? (
        <div className="item"><Skeleton h={120} w="100%" /></div>
      ) : playerRequests.length === 0 ? (
        <EmptyState title="Нет запросов" hint="Запросов по выбранному фильтру нет." />
      ) : (
        <div className="list" ref={requestsRef}>
          {playerRequests.map((requestItem) => (
            <div key={requestItem.id} className="item taped u-items-start">
              <div className="u-flex-1">
                <div className="row u-row-gap-8">
                  {renderStatusBadge(requestItem.status)}
                  <div className="u-fw-900">Запрос #{requestItem.id}</div>
                </div>
                <div className="small">Создан: {new Date(requestItem.createdAt).toLocaleString()}</div>
                {requestItem.resolvedAt ? (
                  <div className="small">Решён: {new Date(requestItem.resolvedAt).toLocaleString()}</div>
                ) : null}
                {requestItem.reason ? (
                  <div className="small u-mt-6">
                    <b>Причина:</b> {requestItem.reason}
                  </div>
                ) : null}
                {requestItem.dmNote ? (
                  <div className="small u-mt-6">
                    <b>Ответ DM:</b> {requestItem.dmNote}
                  </div>
                ) : null}
                <div className="u-mt-8">{renderChanges(requestItem.proposedChanges)}</div>
              </div>
              <div className="u-col-minw-160">
                <button className="btn secondary" onClick={() => applyFromRequest(requestItem)} disabled={readOnly}>
                  <Copy className="icon" aria-hidden="true" />Скопировать в форму
                </button>
                {requestItem.status === "pending" ? (
                  <>
                    <textarea
                      value={requestNotes[requestItem.id] || ""}
                      onChange={(event) => setRequestNotes((prev) => ({ ...prev, [requestItem.id]: event.target.value }))}
                      rows={3}
                      disabled={readOnly}
                      maxLength={500}
                      placeholder="Ответ DM (опционально)"
                      aria-label="Ответ DM по запросу"
                      className="u-w-full"
                    />
                    <button className="btn" onClick={() => approve(requestItem.id)} disabled={readOnly}>Одобрить</button>
                    <button className="btn secondary" onClick={() => reject(requestItem.id)} disabled={readOnly}>Отклонить</button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function renderChanges(changes) {
  const entries = Object.entries(changes || {});
  if (!entries.length) return <div className="small">Нет данных</div>;
  return (
    <div className="list">
      {entries.map(([key, value]) => (
        <div key={key} className="row u-items-start">
          <span className="badge secondary u-text-none">{DM_PROFILE_FIELD_LABELS[key] || key}</span>
          <span className="small u-pre-wrap">{formatProfileRequestValue(value)}</span>
        </div>
      ))}
    </div>
  );
}

function renderStatusBadge(status) {
  const value = String(status || "pending");
  if (value === "approved") return <span className="badge ok">Одобрено</span>;
  if (value === "rejected") return <span className="badge off">Отклонено</span>;
  return <span className="badge warn">В ожидании</span>;
}
