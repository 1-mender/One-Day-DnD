import { ImageUp, PencilLine, RefreshCcw, Send } from "lucide-react";
import EmptyState from "../../../components/ui/EmptyState.jsx";
import Skeleton from "../../../components/ui/Skeleton.jsx";
import { StatsView } from "../../../components/profile/StatsEditor.jsx";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";
import { formatChangeFields } from "../../profileDomain.js";

export default function ProfileContent({ controller }) {
  const {
    allowRequests,
    canEdit,
    canEditAny,
    canEditBasic,
    editableFields,
    loadRequests,
    openEdit,
    openRequest,
    playerId,
    profile,
    raceBonus,
    raceBonusLabel,
    raceHint,
    raceLabel,
    readOnly,
    reqLoading,
    reqStatus,
    requests,
    requestsRef,
    setReqStatus
  } = controller;

  return (
    <div className="list profile-visibility-flow">
      <section className="profile-visibility-block profile-visibility-public">
        <div className="profile-visibility-head">
          <div className="title">Публичный блок</div>
          <span className="badge ok">видят все игроки</span>
        </div>
        <div className="small note-hint profile-visibility-hint">
          Визитка персонажа и биография доступны всей группе.
        </div>

        <div className="spread-grid profile-grid">
          <div className="paper-note character-card profile-card">
            <div className="profile-card-head">
              <div className="title">Визитка</div>
              {canEdit("avatarUrl") ? (
                <button className="btn secondary" onClick={() => openEdit("avatar")}>
                  <ImageUp className="icon" aria-hidden="true" />Редактировать
                </button>
              ) : null}
            </div>
            <div className="small note-hint profile-hint">Публичная карточка персонажа.</div>
            <div className="character-hero profile-hero">
              <div className="character-portrait">
                <PolaroidFrame
                  className="lg character-polaroid"
                  src={profile.avatarUrl}
                  alt={profile.characterName}
                  fallback={(profile.characterName || "?").slice(0, 1)}
                />
                <div className="character-tags">
                  <span className="badge secondary">{profile.classRole || "Класс/роль"}</span>
                  <span className="badge">ур. {profile.level ?? "?"}</span>
                </div>
              </div>
              <div className="character-info profile-info">
                <div className="character-nameplate">{profile.characterName || "Без имени"}</div>
                <div className="small character-race" title={raceHint} aria-label={raceHint}>
                  <span className="character-race-label">Раса:</span>
                  <span className="character-race-value">{raceLabel}</span>
                  <span className={`badge ${raceBonus > 0 ? "ok" : raceBonus < 0 ? "off" : "secondary"}`}>
                    {raceBonusLabel}
                  </span>
                </div>
                {canEditBasic ? (
                  <button className="btn secondary profile-action" onClick={() => openEdit("basic")}>
                    <PencilLine className="icon" aria-hidden="true" />Редактировать
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="paper-note profile-section">
            <div className="profile-section-head">
              <div className="title">
                <span className="section-icon bio" aria-hidden="true" />Биография
              </div>
              {canEdit("bio") ? (
                <button className="btn secondary" onClick={() => openEdit("bio")}>
                  <PencilLine className="icon" aria-hidden="true" />Редактировать
                </button>
              ) : null}
            </div>
            <div className="small bio-text profile-bio">{profile.bio || "Пока пусто"}</div>
          </div>
        </div>
      </section>

      <section className="profile-visibility-block profile-visibility-private">
        <div className="profile-visibility-head">
          <div className="title">Приватный блок</div>
          <span className="badge warn">только ты и DM</span>
        </div>
        <div className="small note-hint profile-visibility-hint">
          Статы, права на редактирование и история заявок видны только тебе и DM.
        </div>

        <div className="list profile-private-stack">
          <div className="paper-note profile-section">
            <div className="profile-section-head">
              <div className="title">
                <span className="section-icon stat" aria-hidden="true" />Статы
              </div>
              {canEdit("stats") ? (
                <button className="btn secondary" onClick={() => openEdit("stats")}>
                  <PencilLine className="icon" aria-hidden="true" />Редактировать
                </button>
              ) : null}
            </div>
            <div className="profile-section-body">
              <StatsView stats={profile.stats} />
            </div>
          </div>

          <div className="paper-note profile-section">
            <div className="title">Права на редактирование</div>
            <div className="small note-hint profile-editable-fields">
              Разрешено редактировать: {editableFields.length ? editableFields.join(", ") : "нет"}
            </div>
          </div>

          {allowRequests && !readOnly ? (
            <div className="paper-note profile-section">
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="title">Запросить изменение</div>
                <button className="btn" onClick={openRequest}>
                  <Send className="icon" aria-hidden="true" />Запросить изменение
                </button>
              </div>
              <div className="small note-hint" style={{ marginTop: 6 }}>
                Используйте запрос, если прямое редактирование запрещено.
              </div>
            </div>
          ) : null}
          {!allowRequests && !canEditAny && !readOnly ? (
            <div className="paper-note profile-section">
              <div className="title">Редактирование отключено</div>
              <div className="small note-hint" style={{ marginTop: 6 }}>
                DM не разрешил редактирование и запросы. Если нужно, обратитесь к DM.
              </div>
            </div>
          ) : null}

          <div className="paper-note profile-section">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="title">Последние запросы</div>
              <button className="btn secondary" onClick={() => loadRequests(playerId, reqStatus)}>
                <RefreshCcw className="icon" aria-hidden="true" />Обновить
              </button>
            </div>
            <div className="small note-hint" style={{ marginTop: 6 }}>Показываются последние 10 запросов.</div>
            <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
              {["all", "pending", "approved", "rejected"].map((status) => (
                <button
                  key={status}
                  className={`btn ${reqStatus === status ? "" : "secondary"}`}
                  onClick={() => setReqStatus(status)}
                >
                  {getStatusLabel(status)}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 10 }}>
              {reqLoading ? (
                <Skeleton h={80} w="100%" />
              ) : requests.length === 0 ? (
                <EmptyState title="Нет запросов" hint="История запросов пока пустая." />
              ) : (
                <div className="list" ref={requestsRef}>
                  {requests.map((requestItem) => (
                    <div key={requestItem.id} className="item" style={{ alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div className="row" style={{ gap: 8 }}>
                          {renderStatusBadge(requestItem.status)}
                          <span className="small">#{requestItem.id}</span>
                          <span className="small">{new Date(requestItem.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="small" style={{ marginTop: 6 }}>
                          Поля: {formatChangeFields(requestItem.proposedChanges)}
                        </div>
                        {requestItem.reason ? (
                          <div className="small" style={{ marginTop: 6 }}>
                            <b>Причина:</b> {requestItem.reason}
                          </div>
                        ) : null}
                        {requestItem.dmNote ? (
                          <div className="small" style={{ marginTop: 6 }}>
                            <b>Ответ DM:</b> {requestItem.dmNote}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function renderStatusBadge(status) {
  const value = String(status || "pending");
  if (value === "approved") return <span className="badge ok">Одобрено</span>;
  if (value === "rejected") return <span className="badge off">Отклонено</span>;
  return <span className="badge warn">В ожидании</span>;
}

function getStatusLabel(status) {
  if (status === "pending") return "В ожидании";
  if (status === "approved") return "Одобрено";
  if (status === "rejected") return "Отклонено";
  return "Все";
}
