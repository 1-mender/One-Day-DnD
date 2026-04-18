import { useMemo, useState } from "react";
import { BookOpenText, Clock3, Eye, ImageUp, PencilLine, RefreshCcw, ScrollText, Send, Shield } from "lucide-react";
import { EmptyState, Skeleton } from "../../../foundation/primitives/index.js";
import { StatsView } from "../../../components/profile/StatsEditor.jsx";
import PolaroidFrame from "../../../components/vintage/PolaroidFrame.jsx";
import { PUBLIC_PROFILE_FIELD_OPTIONS, formatChangeFields } from "../../profileDomain.js";

const PROFILE_TABS = [
  { key: "self", label: "Персонаж" },
  { key: "public", label: "Партия" },
  { key: "extra", label: "Детали" }
];

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
    publicSettingsDirty,
    publicSettingsDraft,
    publicSettingsSaving,
    raceBonus,
    raceBonusLabel,
    raceHint,
    raceLabel,
    readOnly,
    reqLoading,
    reqStatus,
    requests,
    requestsRef,
    savePublicSettings,
    setPublicBlurbDraft,
    setPublicFieldOpen,
    setReqStatus
  } = controller;

  const [viewMode, setViewMode] = useState("self");
  const publicPreview = useMemo(
    () => createPublicProfilePreview(profile, raceLabel, publicSettingsDraft),
    [profile, publicSettingsDraft, raceLabel]
  );
  const accessState = getProfileAccessState({ editableFields, allowRequests, readOnly });
  const requestCallout = getRequestCallout({ allowRequests, canEditAny, readOnly });

  return (
    <div className="list profile-visibility-flow">
      <ProfileTabSwitch value={viewMode} onChange={setViewMode} />

      {viewMode === "self" ? (
        <MyCharacterPanel
          accessState={accessState}
          canEdit={canEdit}
          canEditBasic={canEditBasic}
          openEdit={openEdit}
          playerId={playerId}
          profile={profile}
          raceBonus={raceBonus}
          raceBonusLabel={raceBonusLabel}
          raceHint={raceHint}
          raceLabel={raceLabel}
        />
      ) : null}

      {viewMode === "public" ? (
        <PublicProfilePreview
          playerId={playerId}
          preview={publicPreview}
          profile={profile}
          publicSettingsDirty={publicSettingsDirty}
          publicSettingsDraft={publicSettingsDraft}
          publicSettingsSaving={publicSettingsSaving}
          readOnly={readOnly}
          onSave={savePublicSettings}
          onSetBlurb={setPublicBlurbDraft}
          onSetFieldOpen={setPublicFieldOpen}
        />
      ) : null}

      {viewMode === "extra" ? (
        <ExtraProfilePanel
          allowRequests={allowRequests}
          canEdit={canEdit}
          canEditAny={canEditAny}
          editableFields={editableFields}
          loadRequests={loadRequests}
          openEdit={openEdit}
          openRequest={openRequest}
          playerId={playerId}
          profile={profile}
          readOnly={readOnly}
          requestCallout={requestCallout}
          reqLoading={reqLoading}
          reqStatus={reqStatus}
          requests={requests}
          requestsRef={requestsRef}
          setReqStatus={setReqStatus}
        />
      ) : null}
    </div>
  );
}

function ProfileTabSwitch({ value, onChange }) {
  return (
    <div className="profile-view-switch profile-view-switch-three tf-panel" role="tablist" aria-label="Раздел профиля">
      {PROFILE_TABS.map((tab) => (
        <button
          key={tab.key}
          type="button"
          role="tab"
          aria-selected={value === tab.key}
          className={`profile-view-tab ${value === tab.key ? "profile-view-tab-active" : ""}`}
          onClick={() => onChange(tab.key)}
        >
          {tab.key === "public" ? <Eye className="icon" aria-hidden="true" /> : null}
          <span className="profile-view-tab-label">{tab.label}</span>
        </button>
      ))}
    </div>
  );
}

function MyCharacterPanel({
  accessState,
  canEdit,
  canEditBasic,
  openEdit,
  playerId,
  profile,
  raceBonus,
  raceBonusLabel,
  raceHint,
  raceLabel
}) {
  const heroMonogram = getHeroMonogram(profile);
  const showRaceBonus = raceBonus !== 0;

  return (
    <section className="profile-visibility-block profile-codex-panel tf-panel tf-profile-panel">
      <div className="profile-mode-head">
        <div>
          <div className="profile-section-kicker tf-section-kicker">Character sheet</div>
          <div className="title profile-block-title">Мой персонаж</div>
        </div>
        <span className="badge secondary profile-visibility-badge">полный вид</span>
      </div>

      <div className="profile-character-layout">
        <div className="paper-note character-card profile-card profile-hero-card profile-character-card tf-panel tf-profile-entity">
          <div className="profile-card-head tf-section-head">
            <div className="tf-section-copy">
              <div className="profile-section-kicker tf-section-kicker">Лицевая карточка</div>
              <div className="title profile-card-title">Кто ты в партии</div>
            </div>
            {canEdit("avatarUrl") ? (
              <button className="btn secondary profile-inline-btn" onClick={() => openEdit("avatar")}>
                <ImageUp className="icon" aria-hidden="true" />Аватар
              </button>
            ) : null}
          </div>

          <div className="character-hero profile-hero profile-character-hero">
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
                <div className="profile-sigil" aria-hidden="true">{heroMonogram}</div>
                <div>
                  <div className="character-nameplate profile-nameplate">{profile.characterName || "Без имени"}</div>
                  <div className="small profile-name-subtitle">Персонаж партии</div>
                </div>
              </div>
              <div className="small character-race profile-race-row" title={raceHint} aria-label={raceHint}>
                <span className="character-race-label">Раса:</span>
                <span className="character-race-value">{raceLabel}</span>
                {showRaceBonus ? (
                  <span className={`badge profile-race-bonus ${raceBonus > 0 ? "ok" : "off"}`}>
                    {raceBonusLabel}
                  </span>
                ) : null}
              </div>
              <div className="profile-hero-stats">
                <div className="profile-stat-plaque">
                  <span className="profile-stat-label">ID игрока</span>
                  <span className="profile-stat-value">#{playerId ?? "?"}</span>
                </div>
                <div className="profile-stat-plaque">
                  <span className="profile-stat-label">Доступ</span>
                  <span className="profile-stat-value">{accessState.label}</span>
                </div>
              </div>
              {canEditBasic ? (
                <button className="btn secondary profile-action profile-inline-btn" onClick={() => openEdit("basic")}>
                  <PencilLine className="icon" aria-hidden="true" />Редактировать персонажа
                </button>
              ) : null}
            </div>
          </div>
        </div>

        <div className="paper-note profile-section profile-codex-inset tf-panel profile-bio-card">
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
          <div className="small note-hint profile-hint">
            Это личная биография. Для партии используется отдельное публичное описание.
          </div>
          <div className="small bio-text profile-bio">{profile.bio || "Пока пусто"}</div>
        </div>
      </div>
    </section>
  );
}

function PublicProfilePreview({
  playerId,
  preview,
  profile,
  publicSettingsDirty,
  publicSettingsDraft,
  publicSettingsSaving,
  readOnly,
  onSave,
  onSetBlurb,
  onSetFieldOpen
}) {
  const heroMonogram = getHeroMonogram({
    characterName: preview.characterName,
    classRole: preview.classRole
  });
  const optionalFields = [
    { key: "classRole", label: "Класс / роль", value: profile?.classRole || "не заполнено" },
    { key: "level", label: "Уровень", value: profile?.level != null ? `ур. ${profile.level}` : "не заполнено" },
    { key: "race", label: "Раса", value: preview.race || "не заполнено" },
    { key: "publicBlurb", label: "Публичное описание", value: publicSettingsDraft?.publicBlurb || "не заполнено" }
  ];
  const openOptional = optionalFields.filter((field) => preview.publicFieldSet.has(field.key));
  const hiddenOptional = optionalFields.filter((field) => !preview.publicFieldSet.has(field.key));
  const hasMeta = Boolean(preview.classRole || preview.level != null || preview.race);
  const hasBlurb = Boolean(preview.publicBlurb);
  const summary = getPublicSummary(preview);

  return (
    <section className="profile-visibility-block profile-public-preview-block profile-codex-panel tf-panel tf-profile-panel">
      <div className="profile-mode-head">
        <div>
          <div className="profile-section-kicker tf-section-kicker">Public card</div>
          <div className="title profile-block-title">Видно партии</div>
        </div>
        <span className="badge ok profile-visibility-badge">публично</span>
      </div>

      <div className="profile-public-summary">
        Партия видит: <b>{summary.join(", ")}</b>.
      </div>

      <div className="profile-public-preview-grid profile-public-preview-grid-simple">
        <div className="paper-note profile-public-card tf-panel">
          <div className="profile-public-card-portrait">
            <PolaroidFrame
              className="lg profile-polaroid"
              src={preview.avatarUrl}
              alt={preview.characterName}
              fallback={(preview.characterName || "?").slice(0, 1)}
            />
            <div className="profile-public-sigil" aria-hidden="true">{heroMonogram}</div>
          </div>

          <div className="profile-public-card-copy">
            <div className="profile-public-name">{preview.characterName || "Без имени"}</div>
            <div className="small profile-name-subtitle">Игрок #{playerId ?? "?"}</div>

            {hasMeta ? (
              <div className="profile-public-meta">
                {preview.classRole ? <span className="badge secondary">{preview.classRole}</span> : null}
                {preview.level != null ? <span className="badge">ур. {preview.level}</span> : null}
                {preview.race ? <span className="badge secondary">{preview.race}</span> : null}
              </div>
            ) : null}

            {hasBlurb ? (
              <div className="profile-public-blurb u-pre-wrap">{preview.publicBlurb}</div>
            ) : null}
          </div>

          {!hasMeta && !hasBlurb ? (
            <div className="profile-public-empty-note">
              Остальные данные персонажа скрыты. Другие игроки видят только базовую карточку.
            </div>
          ) : null}
        </div>

        <div className="paper-note profile-public-fields tf-panel profile-public-settings-card">
          <div className="profile-public-settings-head">
            <div>
              <div className="title profile-card-title">Показать партии</div>
              <div className="small note-hint">Переключи поля и сразу смотри превью.</div>
            </div>
          </div>

          <div className="profile-public-toggle-list">
            {PUBLIC_PROFILE_FIELD_OPTIONS.map((option) => (
              <label key={option.key} className="profile-public-toggle-row">
                <input
                  type="checkbox"
                  checked={(publicSettingsDraft?.publicFields || []).includes(option.key)}
                  disabled={readOnly}
                  onChange={(event) => onSetFieldOpen(option.key, event.target.checked)}
                />
                <span>{option.label}</span>
              </label>
            ))}
          </div>

          <label className="profile-public-blurb-editor">
            <span className="small note-hint">Публичное описание</span>
            <textarea
              value={publicSettingsDraft?.publicBlurb || ""}
              disabled={readOnly}
              rows={4}
              maxLength={280}
              placeholder="Краткое описание, которое увидит партия..."
              onChange={(event) => onSetBlurb(event.target.value)}
            />
            <span className="small note-hint">{String(publicSettingsDraft?.publicBlurb || "").length}/280</span>
          </label>

          <button
            type="button"
            className="btn profile-public-save-btn"
            disabled={readOnly || publicSettingsSaving || !publicSettingsDirty}
            onClick={onSave}
          >
            {publicSettingsSaving ? "Сохраняю..." : "Сохранить"}
          </button>

          <details className="profile-public-details">
            <summary>Подробно: открыто и скрыто</summary>
            <div className="profile-public-details-body">
              <div className="profile-public-field-list">
                <PublicFieldRow label="Имя" value={preview.characterName || "Без имени" } state="open" />
                <PublicFieldRow label="Аватар" value={preview.avatarUrl ? "открыт" : "нет аватара"} state="open" />
                {openOptional.map((field) => (
                  <PublicFieldRow key={field.key} label={field.label} value={field.value} state="open" />
                ))}
              </div>
              {hiddenOptional.length ? (
                <div className="profile-public-field-list">
                  {hiddenOptional.map((field) => (
                    <PublicFieldRow key={field.key} label={field.label} value="не показывается" state="hidden" />
                  ))}
                </div>
              ) : null}
            </div>
          </details>
        </div>
      </div>
    </section>
  );
}

function ExtraProfilePanel({
  allowRequests,
  canEdit,
  canEditAny,
  editableFields,
  loadRequests,
  openEdit,
  openRequest,
  playerId,
  profile,
  readOnly,
  requestCallout,
  reqLoading,
  reqStatus,
  requests,
  requestsRef,
  setReqStatus
}) {
  const statsOpen = hasStatsData(profile?.stats);

  return (
    <section className="profile-visibility-block profile-visibility-private profile-codex-panel profile-codex-panel-private tf-panel tf-profile-panel tf-profile-panel-private">
      <div className="profile-mode-head">
        <div>
          <div className="profile-section-kicker tf-section-kicker">Details</div>
          <div className="title profile-block-title">Дополнительно</div>
        </div>
        <span className="badge warn profile-visibility-badge">только ты и DM</span>
      </div>
      <div className="small note-hint profile-visibility-hint">
        Статы, права на редактирование и история запросов вынесены сюда, чтобы главный профиль оставался коротким.
      </div>

      <div className="list profile-private-stack profile-extra-stack">
        <details className="profile-collapse" open={statsOpen}>
          <summary>
            <span><Shield className="profile-section-icon" aria-hidden="true" />Статы</span>
            <span className="badge secondary">{statsOpen ? "заполнены" : "пусто"}</span>
          </summary>
          <div className="profile-collapse-body">
            {canEdit("stats") ? (
              <button className="btn secondary profile-inline-btn" onClick={() => openEdit("stats")}>
                <PencilLine className="icon" aria-hidden="true" />Редактировать
              </button>
            ) : null}
            <div className="profile-section-body">
              <StatsView stats={profile.stats} />
            </div>
          </div>
        </details>

        <details className="profile-collapse">
          <summary>
            <span><ScrollText className="profile-section-icon" aria-hidden="true" />Права на редактирование</span>
            <span className="badge secondary">{editableFields.length ? editableFields.length : "нет"}</span>
          </summary>
          <div className="profile-collapse-body">
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
        </details>

        {requestCallout ? (
          <div className="paper-note profile-section profile-request-callout tf-panel">
            <div className="profile-flex-head">
              <div className="tf-section-copy">
                <div className="profile-section-kicker tf-section-kicker">Через мастера</div>
                <div className="title profile-card-title">{requestCallout.title}</div>
              </div>
              <button className="btn profile-request-btn" onClick={openRequest}>
                <Send className="icon" aria-hidden="true" />{requestCallout.buttonLabel}
              </button>
            </div>
            <div className="small note-hint profile-callout-hint">
              {requestCallout.hint}
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

        <details className="profile-collapse" open={requests.length > 0}>
          <summary>
            <span><Clock3 className="profile-section-icon" aria-hidden="true" />История запросов</span>
            <span className="badge secondary">{requests.length}</span>
          </summary>
          <div className="profile-collapse-body">
            <div className="profile-flex-head">
              <div className="small note-hint profile-callout-hint">Показываются последние 10 запросов.</div>
              <button className="btn secondary profile-inline-btn" onClick={() => loadRequests(playerId, reqStatus)}>
                <RefreshCcw className="icon" aria-hidden="true" />Обновить
              </button>
            </div>
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
                <EmptyState className="profile-request-empty" title="Нет запросов" hint="История запросов пока пустая." />
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
        </details>
      </div>
    </section>
  );
}

function PublicFieldRow({ label, value, state }) {
  return (
    <div className={`profile-public-field-row profile-public-field-${state}`}>
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function createPublicProfilePreview(profile, raceLabel, publicSettingsDraft) {
  const publicFields = normalizePublicFields(publicSettingsDraft?.publicFields ?? profile?.publicFields);
  const publicFieldSet = new Set(publicFields);
  const publicBlurbDraft = publicSettingsDraft?.publicBlurb ?? profile?.publicBlurb ?? "";
  return {
    publicFields,
    publicFieldSet,
    characterName: profile?.characterName || "",
    avatarUrl: profile?.avatarUrl || "",
    classRole: publicFieldSet.has("classRole") ? profile?.classRole || "" : "",
    level: publicFieldSet.has("level") ? profile?.level ?? null : null,
    race: publicFieldSet.has("race") ? raceLabel || "" : "",
    publicBlurb: publicFieldSet.has("publicBlurb") ? publicBlurbDraft || "" : ""
  };
}

function getPublicSummary(preview) {
  const summary = ["имя", "аватар"];
  if (preview.classRole) summary.push("класс");
  if (preview.level != null) summary.push("уровень");
  if (preview.race) summary.push("расу");
  if (preview.publicBlurb) summary.push("описание");
  return summary;
}

function normalizePublicFields(value) {
  if (Array.isArray(value)) return value.map(String);
  if (!value) return [];
  try {
    const parsed = typeof value === "string" ? JSON.parse(value) : value;
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
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
  const key = String(value || "");
  const labels = {
    avatarUrl: "Аватар",
    bio: "Биография",
    stats: "Статы",
    level: "Уровень",
    classRole: "Класс / роль",
    characterName: "Имя персонажа"
  };
  if (labels[key]) return labels[key];
  return key
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function getHeroMonogram(profile) {
  const candidate = profile?.characterName || profile?.classRole || "";
  const letter = String(candidate).trim().slice(0, 1).toUpperCase();
  return letter || "P";
}

function getProfileAccessState({ editableFields, allowRequests, readOnly }) {
  if (readOnly) {
    return { key: "read_only", label: "Просмотр" };
  }

  const editableCount = Array.isArray(editableFields) ? editableFields.length : 0;
  if (editableCount >= ALL_EDITABLE_FIELDS.length) {
    return { key: "full_edit", label: "Полный доступ" };
  }
  if (editableCount > 0) {
    return { key: "partial_edit", label: "Частичное редактирование" };
  }
  if (allowRequests) {
    return { key: "request_only", label: "Только запрос" };
  }
  return { key: "view_only", label: "Только просмотр" };
}

function getRequestCallout({ allowRequests, canEditAny, readOnly }) {
  if (readOnly || !allowRequests) return null;
  if (canEditAny) {
    return {
      title: "Запрос для закрытых полей",
      buttonLabel: "Отправить запрос",
      hint: "Часть полей можно редактировать сразу. Для остальных изменений используйте запрос к DM."
    };
  }
  return {
    title: "Запросить изменение",
    buttonLabel: "Отправить запрос",
    hint: "Прямое редактирование отключено. Изменения профиля отправляются через DM."
  };
}

function hasStatsData(stats) {
  if (!stats || typeof stats !== "object") return false;
  return Object.values(stats).some((value) => value !== "" && value != null);
}

const ALL_EDITABLE_FIELDS = [
  "avatarUrl",
  "bio",
  "stats",
  "level",
  "classRole",
  "characterName"
];
