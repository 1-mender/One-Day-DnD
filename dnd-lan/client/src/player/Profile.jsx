import React, { useEffect, useMemo, useRef, useState } from "react";
import { api, storage } from "../api.js";
import { connectSocket } from "../socket.js";
import PolaroidFrame from "../components/vintage/PolaroidFrame.jsx";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { RefreshCcw, Send, PencilLine, ImageUp } from "lucide-react";
import Modal from "../components/Modal.jsx";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { StatsEditor, StatsView } from "../components/profile/StatsEditor.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { formatError } from "../lib/formatError.js";

const emptyDraft = {
  characterName: "",
  classRole: "",
  level: "",
  stats: {},
  bio: "",
  avatarUrl: ""
};

export default function Profile() {
  const toast = useToast();
  const socket = useMemo(() => connectSocket({ role: "player" }), []);

  const [playerId, setPlayerId] = useState(null);
  const [profile, setProfile] = useState(null);
  const [notCreated, setNotCreated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [editMode, setEditMode] = useState("");
  const [draft, setDraft] = useState(emptyDraft);

  const [requestOpen, setRequestOpen] = useState(false);
  const [requestDraft, setRequestDraft] = useState(emptyDraft);
  const [requestReason, setRequestReason] = useState("");
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqStatus, setReqStatus] = useState("all");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [requestsRef] = useAutoAnimate({ duration: 200 });

  const readOnly = storage.isImpersonating() && storage.getImpMode() === "ro";

  async function load() {
    setErr("");
    setLoading(true);
    try {
      const me = await api.me();
      const pid = me?.player?.id;
      if (!pid) throw new Error("player_not_found");
      setPlayerId(pid);
      const r = await api.playerProfile(pid);
      if (r.notCreated) {
        setProfile(null);
        setNotCreated(true);
      } else {
        setProfile(r.profile);
        setNotCreated(false);
      }
      await loadRequests(pid);
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }

  async function loadRequests(pid = playerId, status = reqStatus) {
    if (!pid) return;
    setReqLoading(true);
    try {
      const r = await api.playerProfileRequests(pid, { limit: 10, status: status === "all" ? "" : status });
      setRequests(r.items || []);
    } catch {
      setRequests([]);
    } finally {
      setReqLoading(false);
    }
  }

  useEffect(() => {
    load().catch(()=>{});
    socket.on("profile:updated", () => load().catch(()=>{}));
    return () => socket.disconnect();
  }, []);

  useEffect(() => {
    if (playerId) loadRequests(playerId, reqStatus).catch(()=>{});
  }, [playerId, reqStatus]);

  const editableFields = profile?.editableFields || [];
  const allowRequests = !!profile?.allowRequests;

  const canEdit = (field) => editableFields.includes(field) && !readOnly;
  const canEditBasic = ["characterName", "classRole", "level"].some((f) => canEdit(f));
  const canEditAny = editableFields.length > 0 && !readOnly;

  function openEdit(mode) {
    if (!profile) return;
    setEditMode(mode);
    setDraft({
      characterName: profile.characterName || "",
      classRole: profile.classRole || "",
      level: profile.level ?? "",
      stats: profile.stats || {},
      bio: profile.bio || "",
      avatarUrl: profile.avatarUrl || ""
    });
  }

  async function saveEdit() {
    if (!playerId || !profile) return;
    const patch = {};
    if (editMode === "basic") {
      if (canEdit("characterName")) patch.characterName = draft.characterName;
      if (canEdit("classRole")) patch.classRole = draft.classRole;
      if (canEdit("level")) patch.level = draft.level === "" ? null : Number(draft.level);
    }
    if (editMode === "stats" && canEdit("stats")) patch.stats = draft.stats || {};
    if (editMode === "bio" && canEdit("bio")) patch.bio = draft.bio || "";
    if (editMode === "avatar" && canEdit("avatarUrl")) patch.avatarUrl = draft.avatarUrl || "";

    if (!Object.keys(patch).length) return;

    setErr("");
    try {
      const r = await api.playerPatchProfile(playerId, patch);
      setProfile(r.profile);
      setEditMode("");
      toast.success("Профиль обновлён");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  async function handleAvatarFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await api.uploadAsset(file);
      setDraft((cur) => ({ ...cur, avatarUrl: r.url || "" }));
      toast.success("Аватар загружен");
    } catch (e2) {
      const msg = formatError(e2);
      setErr(msg);
      toast.error(msg);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function openRequest() {
    if (!profile) return;
    setRequestDraft({
      characterName: profile.characterName || "",
      classRole: profile.classRole || "",
      level: profile.level ?? "",
      stats: profile.stats || {},
      bio: profile.bio || "",
      avatarUrl: profile.avatarUrl || ""
    });
    setRequestReason("");
    setRequestOpen(true);
  }

  function diffProfile(current, next) {
    const out = {};
    if (String(current.characterName || "") !== String(next.characterName || "")) out.characterName = next.characterName || "";
    if (String(current.classRole || "") !== String(next.classRole || "")) out.classRole = next.classRole || "";
    const curLevel = current.level == null ? "" : String(current.level);
    const nextLevel = next.level == null ? "" : String(next.level);
    if (curLevel !== nextLevel) out.level = next.level === "" ? null : Number(next.level);
    if (JSON.stringify(current.stats || {}) !== JSON.stringify(next.stats || {})) out.stats = next.stats || {};
    if (String(current.bio || "") !== String(next.bio || "")) out.bio = next.bio || "";
    if (String(current.avatarUrl || "") !== String(next.avatarUrl || "")) out.avatarUrl = next.avatarUrl || "";
    return out;
  }

  async function submitRequest() {
    if (!playerId || !profile) return;
    const changes = diffProfile(profile, requestDraft);
    if (!Object.keys(changes).length) {
      toast.warn("Нет изменений для запроса");
      return;
    }
    setErr("");
    try {
      await api.playerProfileRequest(playerId, changes, requestReason);
      setRequestOpen(false);
      await loadRequests(playerId);
      toast.success("Запрос отправлен");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  const updatedLabel = profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "-";

  return (
    <div className="card taped no-stamp">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Профиль персонажа</div>
          <div className="small">
            {readOnly ? "read-only (имперсонализация)" : "Твой профиль"} • Обновлён: {updatedLabel}
          </div>
        </div>
        <button className="btn secondary" onClick={load}><RefreshCcw className="icon" />Обновить</button>
      </div>
      <hr />

      <ErrorBanner message={err} onRetry={load} />

      {loading ? (
        <div className="list">
          <div className="item"><Skeleton h={120} w="100%" /></div>
          <div className="item"><Skeleton h={140} w="100%" /></div>
        </div>
      ) : notCreated ? (
        <EmptyState title="Профиль ещё не создан" hint="DM должен создать ваш character profile." />
      ) : (
        <>
          <div className="spread-grid">
            <div className="paper-note">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="title">Визитка</div>
                {canEdit("avatarUrl") ? (
                  <button className="btn secondary" onClick={() => openEdit("avatar")}><ImageUp className="icon" />Редактировать</button>
                ) : null}
                </div>
              <div className="small note-hint" style={{ marginTop: 6 }}>
                Редактирование доступно, если DM разрешил поле.
              </div>
              <div className="row" style={{ alignItems: "flex-start", marginTop: 12 }}>
                <PolaroidFrame className="lg" src={profile.avatarUrl} alt={profile.characterName} fallback={(profile.characterName || "?").slice(0, 1)} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 1000, fontSize: 20 }}>{profile.characterName || "Без имени"}</div>
                  <div className="small" style={{ marginTop: 6 }}>
                    {profile.classRole || "Класс/роль"} • lvl {profile.level ?? "?"}
                  </div>
                  <div className="small" style={{ marginTop: 8 }}>
                    Разрешено редактировать: {editableFields.length ? editableFields.join(", ") : "нет"}
                  </div>
                  {canEditBasic ? (
                    <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => openEdit("basic")}><PencilLine className="icon" />Редактировать</button>
                  ) : null}
                </div>
              </div>
            </div>

            <div className="list">
              <div className="paper-note">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="title"><span className="section-icon stat" aria-hidden="true" />Статы</div>
                  {canEdit("stats") ? (
                    <button className="btn secondary" onClick={() => openEdit("stats")}><PencilLine className="icon" />Редактировать</button>
                  ) : null}
                </div>
                <div style={{ marginTop: 10 }}>
                  <StatsView stats={profile.stats} />
                </div>
              </div>

              <div className="paper-note">
                <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                  <div className="title"><span className="section-icon bio" aria-hidden="true" />Биография</div>
                  {canEdit("bio") ? (
                    <button className="btn secondary" onClick={() => openEdit("bio")}><PencilLine className="icon" />Редактировать</button>
                  ) : null}
                </div>
                <div className="small bio-text" style={{ marginTop: 10, whiteSpace: "pre-wrap" }}>
                  {profile.bio || "Пока пусто"}
                </div>
              </div>
            </div>
          </div>

          {allowRequests && !readOnly ? (
            <div className="paper-note" style={{ marginTop: 14 }}>
              <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
                <div className="title">Запросить изменение</div>
                <button className="btn" onClick={openRequest}><Send className="icon" />Запросить изменение</button>
              </div>
              <div className="small note-hint" style={{ marginTop: 6 }}>
                Используйте запрос, если прямое редактирование запрещено.
              </div>
            </div>
          ) : null}
          {!allowRequests && !canEditAny && !readOnly ? (
            <div className="paper-note" style={{ marginTop: 14 }}>
              <div className="title">Редактирование отключено</div>
              <div className="small note-hint" style={{ marginTop: 6 }}>
                DM не разрешил редактирование и запросы. Если нужно — обратитесь к DM.
              </div>
            </div>
          ) : null}

          <div className="paper-note" style={{ marginTop: 14 }}>
            <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
              <div className="title">Последние запросы</div>
              <button className="btn secondary" onClick={() => loadRequests(playerId, reqStatus)}><RefreshCcw className="icon" />Обновить</button>
            </div>
            <div className="small note-hint" style={{ marginTop: 6 }}>Показываются последние 10 запросов.</div>
            <div className="row" style={{ marginTop: 8, flexWrap: "wrap" }}>
              <button className={`btn ${reqStatus === "all" ? "" : "secondary"}`} onClick={() => setReqStatus("all")}>Все</button>
              <button className={`btn ${reqStatus === "pending" ? "" : "secondary"}`} onClick={() => setReqStatus("pending")}>В ожидании</button>
              <button className={`btn ${reqStatus === "approved" ? "" : "secondary"}`} onClick={() => setReqStatus("approved")}>Одобрено</button>
              <button className={`btn ${reqStatus === "rejected" ? "" : "secondary"}`} onClick={() => setReqStatus("rejected")}>Отклонено</button>
            </div>
            <div style={{ marginTop: 10 }}>
              {reqLoading ? (
                <Skeleton h={80} w="100%" />
              ) : requests.length === 0 ? (
                <EmptyState title="Нет запросов" hint="История запросов пока пустая." />
              ) : (
                <div className="list" ref={requestsRef}>
                  {requests.map((r) => (
                    <div key={r.id} className="item" style={{ alignItems: "flex-start" }}>
                      <div style={{ flex: 1 }}>
                        <div className="row" style={{ gap: 8 }}>
                          {renderStatusBadge(r.status)}
                          <span className="small">#{r.id}</span>
                          <span className="small">{new Date(r.createdAt).toLocaleString()}</span>
                        </div>
                        <div className="small" style={{ marginTop: 6 }}>
                          Поля: {formatChangeFields(r.proposedChanges)}
                        </div>
                        {r.reason ? (
                          <div className="small" style={{ marginTop: 6 }}>
                            <b>Причина:</b> {r.reason}
                          </div>
                        ) : null}
                        {r.dmNote ? (
                          <div className="small" style={{ marginTop: 6 }}>
                            <b>Ответ DM:</b> {r.dmNote}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <Modal open={!!editMode} title="Редактировать профиль" onClose={() => setEditMode("")}>
        <div className="list">
          {editMode === "basic" ? (
            <>
              <div className="small note-hint">Меняются только разрешённые поля.</div>
              {canEdit("characterName") ? (
                <input
                  value={draft.characterName}
                  onChange={(e) => setDraft({ ...draft, characterName: e.target.value })}
                  placeholder="Имя персонажа"
                  maxLength={80}
                  style={inp}
                />
              ) : null}
              {canEdit("classRole") ? (
                <input
                  value={draft.classRole}
                  onChange={(e) => setDraft({ ...draft, classRole: e.target.value })}
                  placeholder="Класс / роль"
                  maxLength={80}
                  style={inp}
                />
              ) : null}
              {canEdit("level") ? (
                <input
                  value={draft.level}
                  onChange={(e) => setDraft({ ...draft, level: e.target.value })}
                  placeholder="Уровень"
                  style={inp}
                />
              ) : null}
            </>
          ) : null}

          {editMode === "stats" ? (
            <StatsEditor value={draft.stats} onChange={(stats) => setDraft({ ...draft, stats })} />
          ) : null}

          {editMode === "bio" ? (
            <>
              <textarea
                value={draft.bio}
                onChange={(e) => setDraft({ ...draft, bio: e.target.value })}
                rows={8}
                maxLength={2000}
                placeholder="Биография (до 2000 символов)"
                style={inp}
              />
              <div className="small">{String(draft.bio || "").length}/2000</div>
            </>
          ) : null}

          {editMode === "avatar" ? (
            <>
              <div className="small note-hint">Можно вставить URL или загрузить файл.</div>
              <input
                value={draft.avatarUrl}
                onChange={(e) => setDraft({ ...draft, avatarUrl: e.target.value })}
                placeholder="URL аватара"
                maxLength={512}
                style={inp}
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarFileChange}
                style={{ display: "none" }}
              />
              <button className="btn secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                <ImageUp className="icon" />{uploading ? "Загрузка..." : "Загрузить файл"}
              </button>
            </>
          ) : null}

          <button className="btn" onClick={saveEdit}>Сохранить</button>
        </div>
      </Modal>

      <Modal open={requestOpen} title="Запрос изменения профиля" onClose={() => setRequestOpen(false)}>
        <div className="list">
          <textarea
            value={requestReason}
            onChange={(e) => setRequestReason(e.target.value)}
            rows={3}
            maxLength={500}
            placeholder="Причина запроса (опционально, до 500 символов)"
            style={inp}
          />
          <div className="small">{String(requestReason || "").length}/500</div>
          <input
            value={requestDraft.characterName}
            onChange={(e) => setRequestDraft({ ...requestDraft, characterName: e.target.value })}
            placeholder="Имя персонажа"
            maxLength={80}
            style={inp}
          />
          <input
            value={requestDraft.classRole}
            onChange={(e) => setRequestDraft({ ...requestDraft, classRole: e.target.value })}
            placeholder="Класс / роль"
            maxLength={80}
            style={inp}
          />
          <input
            value={requestDraft.level}
            onChange={(e) => setRequestDraft({ ...requestDraft, level: e.target.value })}
            placeholder="Уровень"
            style={inp}
          />
          <StatsEditor value={requestDraft.stats} onChange={(stats) => setRequestDraft({ ...requestDraft, stats })} />
          <textarea
            value={requestDraft.bio}
            onChange={(e) => setRequestDraft({ ...requestDraft, bio: e.target.value })}
            rows={6}
            maxLength={2000}
            placeholder="Биография (до 2000 символов)"
            style={inp}
          />
          <div className="small">{String(requestDraft.bio || "").length}/2000</div>
          <input
            value={requestDraft.avatarUrl}
            onChange={(e) => setRequestDraft({ ...requestDraft, avatarUrl: e.target.value })}
            placeholder="URL аватара"
            maxLength={512}
            style={inp}
          />
          <button className="btn" onClick={submitRequest}><Send className="icon" />Отправить запрос</button>
        </div>
      </Modal>
    </div>
  );
}

const inp = { width: "100%" };

function renderStatusBadge(status) {
  const s = String(status || "pending");
  if (s === "approved") return <span className="badge ok">Одобрено</span>;
  if (s === "rejected") return <span className="badge off">Отклонено</span>;
  return <span className="badge warn">В ожидании</span>;
}

const changeLabels = {
  characterName: "Имя",
  classRole: "Класс/роль",
  level: "Уровень",
  stats: "Статы",
  bio: "Биография",
  avatarUrl: "Аватар"
};

function formatChangeFields(changes) {
  const keys = Object.keys(changes || {});
  if (!keys.length) return "—";
  return keys.map((k) => changeLabels[k] || k).join(", ");
}
