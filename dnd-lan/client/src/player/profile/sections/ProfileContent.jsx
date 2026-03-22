import { BookOpenText, Clock3, ImageUp, PencilLine, RefreshCcw, ScrollText, Send, Shield } from "lucide-react";
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
      <section className="profile-visibility-block profile-visibility-public profile-codex-panel tf-panel tf-profile-panel">
        <div className="profile-visibility-head">
          <div className="tf-section-copy">
            <div className="profile-section-kicker tf-section-kicker">Открытая глава</div>
            <div className="title profile-block-title">Публичный блок</div>
          </div>
          <span className="badge ok profile-visibility-badge">видят все игроки</span>
        </div>
        <div className="small note-hint profile-visibility-hint">
          Визитка персонажа и биография доступны всей группе.
        </div>

        <div className="spread-grid profile-grid profile-codex-grid">
          <div className="paper-note character-card profile-card profile-hero-card tf-panel tf-profile-entity">
            <div className="profile-card-head tf-section-head">
              <div className="tf-section-copy">
                <div className="profile-section-kicker tf-section-kicker">Лицевая карточка</div>
                <div className="title profile-card-title">Визитка</div>
              </div>
              {canEdit("avatarUrl") ? (
                <button className="btn secondary profile-inline-btn" onClick={() => openEdit("avatar")}>
                  <ImageUp className="icon" aria-hidden="true" />Редактировать
                </button>
              ) : null}
            </div>
            <div className="small note-hint profile-hint">Публичная карточка персонажа.</div>
            <div className="character-hero profile-hero">
              <div className="character-portrait">
                <PolaroidFrame
                  className="lg character-polaroid profile-polaroid"
                  src={profile.avatarUrl}
                  alt={profile.characterName}
                  fallback={(profile.characterName || "?").slice(0, 1)}
                />
                <div className="character-tags">
                  <span className="badge secondary profile-tag">{profile.classRole || "Класс/роль"}</span>
                  <span className="badge profile-tag">ур. {profile.level ?? "?"}</span>
                </div>
              </div>
              <div className="character-info profile-info">
                <div className="profile-nameplate-wrap">
                  <div className="profile-sigil">?</div>
                  <div>
                    <div className="character-nameplate profile-nameplate">{profile.characterName || "Без имени"}</div>
                    <div className="small profile-name-subtitle">Персонаж партии</div>
                  </div>
                </div>
                <div className="small character-race profile-race-row" title={raceHint} aria-label={raceHint}>
                  <span className="character-race-label">Раса:</span>
                  <span className="character-race-value">{raceLabel}</span>
                  <span className={`badge profile-race-bonus ${raceBonus > 0 ? "ok" : raceBonus < 0 ? "off" : "secondary"}`}>
                    {raceBonusLabel}
                  </span>
                </div>
                <div className="profile-hero-stats">
                  <div className="profile-stat-plaque">
                    <span className="profile-stat-label">ID игрока</span>
                    <span className="profile-stat-value">#{playerId ?? "?"}</span>
                  </div>
                  <div className="profile-stat-plaque">
                    <span className="profile-stat-label">Режим</span>
                    <span className="profile-stat-value">{readOnly ? "Просмотр" : "Редактируемый"}</span>
                  </div>
                </div>
                {canEditBasic ? (
                  <button className="btn secondary profile-action profile-inline-btn" onClick={() => openEdit("basic")}>
                    <PencilLine className="icon" aria-hidden="true" />Редактировать
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="paper-note profile-section profile-codex-inset tf-panel">
            <div className="profile-section-head tf-section-head">
              <div className="title profile-card-title">
                <BookOpenText className="profile-section-icon" aria-hidden="true" />Биография
              </div>
              {canEdit("bio") ? (
                <button className="btn secondary profile-inline-btn" onClick={() => openEdit("bio")}>
                  <PencilLine className="icon" aria-hidden="true" />Редактировать
                </button>
              ) : null}
            </div>
            <div className="small bio-text profile-bio">{profile.bio || "Пока пусто"}</div>
          </div>
        </div>
      </section>

      <section className="profile-visibility-block profile-visibility-private profile-codex-panel profile-codex-panel-private tf-panel tf-profile-panel tf-profile-panel-private">
        <div className="profile-visibility-head">
          <div className="tf-section-copy">
            <div className="profile-section-kicker tf-section-kicker">Скрытая глава</div>
            <div className="title profile-block-title">Приватный блок</div>
          </div>
          <span className="badge warn profile-visibility-badge">только ты и DM</span>
        </div>
        <div className="small note-hint profile-visibility-hint">
          Статы, права на редактирование и история заявок видны только тебе и DM.
        </div>

        <div className="list profile-private-stack">
          <div className="paper-note profile-section profile-codex-inset tf-panel">
            <div className="profile-section-head tf-section-head">
              <div className="title profile-card-title">
                <Shield className="profile-section-icon" aria-hidden="true" />Статы
              </div>
              {canEdit("stats") ? (
                <button className="btn secondary profile-inline-btn" onClick={() => openEdit("stats")}>
                  <PencilLine className="icon" aria-hidden="true" />Редактировать
                </button>
              ) : null}
            </div>
            <div className="profile-section-body">
              <StatsView stats={profile.stats} />
            </div>
          </div>

          <div className="paper-note profile-section profile-codex-inset tf-panel">
            <div className="title profile-detail-title profile-card-title">
              <ScrollText className="profile-section-icon" aria-hidden="true" />Права на редактирование
            </div>
            <div className="small note-hint profile-editable-fields-label">
              Разрешено редактировать:
            </div>
            {editableFields.length ? (
              <div className="profile-editable-chip-list">
                {editableFields.map((field) => (
                  <span key={field} className="profile-editable-chip">
                    {formatEditableFieldLabel(field)}
                  </span>
                ))}
              </div>
            ) : (
              <div className="small note-hint profile-editable-fields">нет</div>
            )}
          </div>

          {allowRequests && !readOnly ? (
            <div className="paper-note profile-section profile-request-callout tf-panel">
              <div className="profile-flex-head">
                <div className="tf-section-copy">
                  <div className="profile-section-kicker tf-section-kicker">Путь через мастера</div>
                  <div className="title profile-card-title">Запросить изменение</div>
                </div>
                <button className="btn profile-request-btn" onClick={openRequest}>
                  <Send className="icon" aria-hidden="true" />Запросить изменение
                </button>
              </div>
              <div className="small note-hint profile-callout-hint">
                Используйте запрос, если прямое редактирование запрещено.
              </div>
            </div>
          ) : null}
          {!allowRequests && !canEditAny && !readOnly ? (
            <div className="paper-note profile-section profile-codex-inset tf-panel">
              <div className="title profile-card-title">Редактирование отключено</div>
              <div className="small note-hint profile-callout-hint">
                DM не разрешил редактирование и запросы. Если нужно, обратитесь к DM.
              </div>
            </div>
          ) : null}

          <div className="paper-note profile-section profile-codex-inset tf-panel">
            <div className="profile-flex-head">
              <div className="tf-section-copy">
                <div className="profile-section-kicker tf-section-kicker">История заявок</div>
                <div className="title profile-card-title">Последние запросы</div>
              </div>
              <button className="btn secondary profile-inline-btn" onClick={() => loadRequests(playerId, reqStatus)}>
                <RefreshCcw className="icon" aria-hidden="true" />Обновить
              </button>
            </div>
            <div className="small note-hint profile-callout-hint">Показываются последние 10 запросов.</div>
            <div className="profile-request-filters tf-segmented">
              {["all", "pending", "approved", "rejected"].map((status) => (
                <button
                  key={status}
                  className={`btn profile-filter-btn tf-segmented-btn ${reqStatus === status ? "profile-filter-btn-active tf-segmented-btn-active" : "secondary"}`}
                  onClick={() => setReqStatus(status)}
                >
                  {getStatusLabel(status)}
                </button>
              ))}
            </div>
            <div className="profile-request-list-wrap">
              {reqLoading ? (
                <Skeleton h={80} w="100%" />
              ) : requests.length === 0 ? (
                <EmptyState title="Нет запросов" hint="История запросов пока пустая." />
              ) : (
                <div className="list profile-request-list" ref={requestsRef}>
                  {requests.map((requestItem) => (
                    <div key={requestItem.id} className="item profile-request-item tf-profile-request-card">
                      <div className="profile-request-icon">
                        <Clock3 aria-hidden="true" />
                      </div>
                      <div className="profile-request-copy">
                        <div className="profile-request-meta">
                          {renderStatusBadge(requestItem.status)}
                          <span className="small">#{requestItem.id}</span>
                          <span className="small">{new Date(requestItem.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="small profile-request-line">
                          Поля: {formatChangeFields(requestItem.proposedChanges)}
                        </div>
                        {requestItem.reason ? (
                          <div className="small profile-request-line">
                            <b>Причина:</b> {requestItem.reason}
                          </div>
                        ) : null}
                        {requestItem.dmNote ? (
                          <div className="small profile-request-line">
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

function formatEditableFieldLabel(value) {
  return String(value || "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}
