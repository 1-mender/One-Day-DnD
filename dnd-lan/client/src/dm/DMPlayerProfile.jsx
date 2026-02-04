import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "../api.js";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import PolaroidFrame from "../components/vintage/PolaroidFrame.jsx";
import { StatsEditor, StatsView } from "../components/profile/StatsEditor.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { formatError } from "../lib/formatError.js";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { RefreshCcw, Save, ImageUp, Copy } from "lucide-react";
import { useSocket } from "../context/SocketContext.jsx";

const editableOptions = [
  { key: "characterName", label: "Имя персонажа" },
  { key: "classRole", label: "Класс / роль" },
  { key: "level", label: "Уровень" },
  { key: "stats", label: "Статы" },
  { key: "bio", label: "Биография" },
  { key: "avatarUrl", label: "Аватар" }
];

const fieldLabels = {
  characterName: "Имя",
  classRole: "Класс/роль",
  level: "Уровень",
  stats: "Статы",
  bio: "Биография",
  avatarUrl: "Аватар"
};

const emptyForm = {
  characterName: "",
  classRole: "",
  level: "",
  stats: {},
  bio: "",
  avatarUrl: "",
  editableFields: [],
  allowRequests: false
};

const statPresets = [
  { key: "commoner", label: "10‑10‑10‑10‑10‑10", stats: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 } },
  { key: "standard", label: "15‑14‑13‑12‑10‑8", stats: { str: 15, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } },
  { key: "hero", label: "16‑14‑13‑12‑10‑8", stats: { str: 16, dex: 14, con: 13, int: 12, wis: 10, cha: 8 } }
];

export default function DMPlayerProfile() {
  const { id } = useParams();
  const playerId = Number(id);
  const nav = useNavigate();
  const toast = useToast();
  const { socket } = useSocket();

  const [player, setPlayer] = useState(null);
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [notCreated, setNotCreated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const [tab, setTab] = useState("profile");
  const [requests, setRequests] = useState([]);
  const [reqLoading, setReqLoading] = useState(false);
  const [reqStatus, setReqStatus] = useState("pending");
  const [requestNotes, setRequestNotes] = useState({});
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);
  const [requestsRef] = useAutoAnimate({ duration: 200 });
  const [profilePresets, setProfilePresets] = useState([]);

  function applyProfile(p) {
    setProfile(p);
    setForm({
      characterName: p?.characterName || "",
      classRole: p?.classRole || "",
      level: p?.level ?? "",
      stats: p?.stats || {},
      bio: p?.bio || "",
      avatarUrl: p?.avatarUrl || "",
      editableFields: p?.editableFields || [],
      allowRequests: !!p?.allowRequests
    });
  }

  const load = useCallback(async () => {
    if (!playerId) return;
    setErr("");
    setLoading(true);
    try {
      const [playersRes, profileRes] = await Promise.all([
        api.dmPlayers(),
        api.playerProfile(playerId)
      ]);
      const found = (playersRes.items || []).find((p) => p.id === playerId);
      setPlayer(found || null);

      if (profileRes.notCreated) {
        setProfile(null);
        setNotCreated(true);
        setForm(emptyForm);
      } else {
        setNotCreated(false);
        applyProfile(profileRes.profile);
      }
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }, [playerId]);

  const loadRequests = useCallback(async () => {
    if (!playerId) return;
    setReqLoading(true);
    try {
      const r = await api.dmProfileRequests("");
      setRequests(r.items || []);
    } catch {
      // ignore
    } finally {
      setReqLoading(false);
    }
  }, [playerId]);

  const loadPresets = useCallback(async () => {
    try {
      const r = await api.dmProfilePresets();
      setProfilePresets(Array.isArray(r?.presets) ? r.presets : []);
    } catch {
      setProfilePresets([]);
    }
  }, []);

  const loadRequestsRef = useRef(null);
  useEffect(() => {
    loadRequestsRef.current = loadRequests;
  }, [loadRequests]);

  const loadPresetsRef = useRef(null);
  useEffect(() => {
    loadPresetsRef.current = loadPresets;
  }, [loadPresets]);

  useEffect(() => {
    if (!socket) return () => {};
    const onCreated = () => loadRequestsRef.current?.().catch(() => {});
    const onUpdated = () => loadRequestsRef.current?.().catch(() => {});
    const onSettings = () => loadPresetsRef.current?.().catch(() => {});
    socket.on("profile:requestCreated", onCreated);
    socket.on("profile:requestsUpdated", onUpdated);
    socket.on("settings:updated", onSettings);
    return () => {
      socket.off("profile:requestCreated", onCreated);
      socket.off("profile:requestsUpdated", onUpdated);
      socket.off("settings:updated", onSettings);
    };
  }, [socket]);

  useEffect(() => {
    load().catch(() => {});
    loadRequests().catch(() => {});
    loadPresets().catch(() => {});
  }, [load, loadRequests, loadPresets]);

  async function save() {
    if (!playerId) return;
    setErr("");
    try {
      const payload = {
        ...form,
        level: form.level === "" ? null : Number(form.level),
        stats: form.stats || {},
        editableFields: form.editableFields || [],
        allowRequests: !!form.allowRequests
      };
      const r = await api.dmUpdatePlayerProfile(playerId, payload);
      applyProfile(r.profile);
      setNotCreated(false);
      toast.success("Профиль сохранён");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  function applyPreset(preset) {
    setForm((prev) => ({ ...prev, stats: { ...preset.stats } }));
  }

  function applyProfilePreset(preset) {
    const data = preset?.data || {};
    const nextLevel = data.level === "" || data.level == null ? "" : Number(data.level);
    setForm((prev) => ({
      ...prev,
      ...data,
      level: Number.isFinite(nextLevel) ? nextLevel : prev.level,
      stats: data.stats ? { ...(data.stats || {}) } : prev.stats
    }));
  }

  function normalizeRequestChanges(changes) {
    const out = {};
    if (!changes || typeof changes !== "object") return out;
    if ("characterName" in changes) out.characterName = String(changes.characterName || "");
    if ("classRole" in changes) out.classRole = String(changes.classRole || "");
    if ("level" in changes) {
      const n = changes.level === "" || changes.level == null ? "" : Number(changes.level);
      out.level = Number.isFinite(n) ? n : "";
    }
    if ("stats" in changes) {
      const raw = changes.stats;
      if (raw && typeof raw === "object") out.stats = raw;
      else {
        try {
          const parsed = JSON.parse(String(raw || "{}"));
          out.stats = parsed && typeof parsed === "object" ? parsed : {};
        } catch {
          out.stats = {};
        }
      }
    }
    if ("bio" in changes) out.bio = String(changes.bio || "");
    if ("avatarUrl" in changes) out.avatarUrl = String(changes.avatarUrl || "");
    return out;
  }

  function applyFromRequest(reqItem) {
    const patch = normalizeRequestChanges(reqItem?.proposedChanges);
    if (!Object.keys(patch).length) return;
    setForm((prev) => ({ ...prev, ...patch }));
    setTab("profile");
    toast.info("Изменения перенесены в форму");
  }

  async function handleAvatarFileChange(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const r = await api.uploadAsset(file);
      setForm((cur) => ({ ...cur, avatarUrl: r.url || "" }));
      toast.success("Аватар загружен");
    } catch (e2) {
      toast.error(formatError(e2));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function resetForm() {
    if (profile) applyProfile(profile);
    else setForm(emptyForm);
  }

  function toggleEditable(key) {
    const set = new Set(form.editableFields || []);
    if (set.has(key)) set.delete(key);
    else set.add(key);
    setForm({ ...form, editableFields: Array.from(set) });
  }

  async function approve(id) {
    try {
      const note = requestNotes[id] || "";
      await api.dmApproveProfileRequest(id, note);
      await load();
      await loadRequests();
      setRequestNotes((prev) => ({ ...prev, [id]: "" }));
      toast.success("Запрос одобрен");
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  async function reject(id) {
    try {
      const note = requestNotes[id] || "";
      await api.dmRejectProfileRequest(id, note);
      await loadRequests();
      setRequestNotes((prev) => ({ ...prev, [id]: "" }));
      toast.warn("Запрос отклонён");
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  const playerRequestsAll = requests.filter((r) => r.playerId === playerId);
  const playerRequests = reqStatus === "all"
    ? playerRequestsAll
    : playerRequestsAll.filter((r) => r.status === reqStatus);
  const showRequestsTab = form.allowRequests || playerRequestsAll.length > 0;
  const updatedLabel = profile?.updatedAt ? new Date(profile.updatedAt).toLocaleString() : "-";
  const dirty = hasUnsavedChanges(form, profile);
  const canSave = dirty || (notCreated && hasAnyData(form));

  return (
    <div className="card taped no-stamp">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>Профиль персонажа</div>
          <div className="small">
            Игрок: <b>{player?.displayName || `#${playerId}`}</b> • Обновлён: {updatedLabel}
            {dirty ? " • есть несохранённые изменения" : ""}
          </div>
        </div>
        <div className="row">
          <button className="btn secondary" onClick={() => nav("/dm/app/players")}>Назад</button>
          <button className="btn" onClick={save} disabled={!canSave}><Save className="icon" aria-hidden="true" />Сохранить</button>
        </div>
      </div>
      <hr />

      <div className="row" style={{ gap: 8 }}>
        <button className={`btn ${tab === "profile" ? "" : "secondary"}`} onClick={() => setTab("profile")}>Профиль</button>
        {showRequestsTab ? (
          <button className={`btn ${tab === "requests" ? "" : "secondary"}`} onClick={() => setTab("requests")}>
            Запросы {playerRequestsAll.length ? `(${playerRequestsAll.length})` : ""}
          </button>
        ) : null}
      </div>

      <div style={{ marginTop: 12 }}>
        <ErrorBanner message={err} onRetry={load} />

        {loading ? (
          <div className="list">
            <div className="item"><Skeleton h={120} w="100%" /></div>
            <div className="item"><Skeleton h={140} w="100%" /></div>
          </div>
        ) : tab === "requests" ? (
            <div className="list">
            <div className="row" style={{ flexWrap: "wrap" }}>
              <div className="small">Фильтр запросов:</div>
              <button className={`btn ${reqStatus === "pending" ? "" : "secondary"}`} onClick={() => setReqStatus("pending")}>
                В ожидании
              </button>
              <button className={`btn ${reqStatus === "approved" ? "" : "secondary"}`} onClick={() => setReqStatus("approved")}>
                Одобрено
              </button>
              <button className={`btn ${reqStatus === "rejected" ? "" : "secondary"}`} onClick={() => setReqStatus("rejected")}>
                Отклонено
              </button>
              <button className={`btn ${reqStatus === "all" ? "" : "secondary"}`} onClick={() => setReqStatus("all")}>
                Все
              </button>
              <button className="btn secondary" onClick={() => loadRequests()}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
            </div>

            {reqLoading ? (
              <div className="item"><Skeleton h={120} w="100%" /></div>
            ) : playerRequests.length === 0 ? (
              <EmptyState title="Нет запросов" hint="Запросов по выбранному фильтру нет." />
            ) : (
              <div className="list" ref={requestsRef}>
                {playerRequests.map((r) => (
                  <div key={r.id} className="item taped" style={{ alignItems: "flex-start" }}>
                    <div style={{ flex: 1 }}>
                      <div className="row" style={{ gap: 8, alignItems: "center" }}>
                        {renderStatusBadge(r.status)}
                        <div style={{ fontWeight: 900 }}>Запрос #{r.id}</div>
                      </div>
                      <div className="small">Создан: {new Date(r.createdAt).toLocaleString()}</div>
                      {r.resolvedAt ? (
                        <div className="small">Решён: {new Date(r.resolvedAt).toLocaleString()}</div>
                      ) : null}
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
                      <div style={{ marginTop: 8 }}>
                        {renderChanges(r.proposedChanges)}
                      </div>
                    </div>
                    <div style={{ minWidth: 160, display: "flex", flexDirection: "column", gap: 8 }}>
                      <button className="btn secondary" onClick={() => applyFromRequest(r)}><Copy className="icon" aria-hidden="true" />Скопировать в форму</button>
                      {r.status === "pending" ? (
                        <>
                          <textarea
                            value={requestNotes[r.id] || ""}
                            onChange={(e) => setRequestNotes((prev) => ({ ...prev, [r.id]: e.target.value }))}
                            rows={3}
                            maxLength={500}
                            placeholder="Ответ DM (опционально)"
                            style={{ width: "100%" }}
                          />
                          <button className="btn" onClick={() => approve(r.id)}>Одобрить</button>
                          <button className="btn secondary" onClick={() => reject(r.id)}>Отклонить</button>
                        </>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <>
            {notCreated ? (
              <EmptyState title="Профиль не создан" hint="Заполните поля и нажмите «Сохранить»." />
            ) : null}
            <div className="spread-grid" style={{ marginTop: 10 }}>
                <div className="paper-note">
                  <div className="title">Данные персонажа</div>
                  {profilePresets.length ? (
                    <div className="preset-panel" style={{ marginTop: 8 }}>
                      <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
                        <div className="small">Глобальные пресеты</div>
                        <div className="small note-hint">Применяет имя, класс, уровень, статы и био.</div>
                      </div>
                      <div className="preset-grid">
                        {profilePresets.map((preset) => (
                          <button
                            key={preset.id || preset.title}
                            type="button"
                            className="preset-card"
                            onClick={() => applyProfilePreset(preset)}
                          >
                            <div className="preset-title">{preset.title}</div>
                            <div className="small">{preset.subtitle}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                  <div className="list" style={{ marginTop: 10 }}>
                    <input value={form.characterName} onChange={(e) => setForm({ ...form, characterName: e.target.value })} placeholder="Имя персонажа" maxLength={80} style={inp} />
                    <input value={form.classRole} onChange={(e) => setForm({ ...form, classRole: e.target.value })} placeholder="Класс / роль" maxLength={80} style={inp} />
                    <input value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value })} placeholder="Уровень" style={inp} />
                  <input value={form.avatarUrl} onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })} placeholder="URL аватара" maxLength={512} style={inp} />
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleAvatarFileChange}
                    style={{ display: "none" }}
                  />
                  <button className="btn secondary" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    <ImageUp className="icon" aria-hidden="true" />{uploading ? "Загрузка..." : "Загрузить аватар"}
                  </button>
                    <div className="small note-hint">Можно вставить URL или загрузить файл (до 10MB).</div>
                    <div className="kv">
                      <div className="title"><span className="section-icon stat" aria-hidden="true" />Статы</div>
                      <div className="row" style={{ flexWrap: "wrap" }}>
                        {statPresets.map((p) => (
                          <button key={p.key} className="btn secondary" onClick={() => applyPreset(p)}>
                            {p.label}
                          </button>
                        ))}
                      </div>
                      <div className="small note-hint">Пресет перезапишет текущие статы.</div>
                      <StatsEditor value={form.stats} onChange={(stats) => setForm({ ...form, stats })} />
                    </div>
                    <div className="kv">
                      <div className="title"><span className="section-icon bio" aria-hidden="true" />Биография</div>
                    <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })} rows={6} maxLength={2000} placeholder="Биография (до 2000 символов)" style={inp} />
                    <div className="small">{String(form.bio || "").length}/2000</div>
                  </div>
                </div>
              </div>

              <div className="list">
                <div className="paper-note">
                  <div className="title">Превью</div>
                  <div className="row" style={{ alignItems: "flex-start", marginTop: 10 }}>
                    <PolaroidFrame className="lg" src={form.avatarUrl} alt={form.characterName} fallback={(form.characterName || "?").slice(0, 1)} />
                    <div>
                      <div style={{ fontWeight: 1000, fontSize: 18 }}>{form.characterName || "Без имени"}</div>
                      <div className="small" style={{ marginTop: 6 }}>
                        {form.classRole || "Класс/роль"} • lvl {form.level || "?"}
                      </div>
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <StatsView stats={form.stats} />
                  </div>
                  <div className="small bio-text" style={{ marginTop: 12, whiteSpace: "pre-wrap" }}>
                    {form.bio || "Биография не заполнена"}
                  </div>
                </div>

                <div className="paper-note">
                  <div className="title">Права игрока</div>
                  <div className="list" style={{ marginTop: 10 }}>
                    {editableOptions.map((opt) => (
                      <label key={opt.key} className="row" style={{ alignItems: "center" }}>
                        <input
                          type="checkbox"
                          checked={(form.editableFields || []).includes(opt.key)}
                          onChange={() => toggleEditable(opt.key)}
                          style={{ width: 18, height: 18 }}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                    <label className="row" style={{ alignItems: "center" }}>
                      <input
                        type="checkbox"
                        checked={!!form.allowRequests}
                        onChange={() => setForm({ ...form, allowRequests: !form.allowRequests })}
                        style={{ width: 18, height: 18 }}
                      />
                      <span>Разрешить запросы на изменение</span>
                    </label>
                  </div>
                  <div className="small note-hint" style={{ marginTop: 6 }}>
                    Игрок сможет менять только отмеченные поля. Запросы — альтернатива для остальных правок.
                  </div>
                  <div className="row" style={{ marginTop: 12, gap: 8 }}>
                    <button className="btn secondary" onClick={resetForm}>Сбросить</button>
                    <button className="btn" onClick={save} disabled={!canSave}><Save className="icon" aria-hidden="true" />Сохранить</button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function renderChanges(changes) {
  const entries = Object.entries(changes || {});
  if (!entries.length) return <div className="small">Нет данных</div>;
  return (
    <div className="list">
      {entries.map(([k, v]) => (
        <div key={k} className="row" style={{ alignItems: "flex-start" }}>
          <span className="badge secondary" style={{ textTransform: "none" }}>{fieldLabels[k] || k}</span>
          <span className="small" style={{ whiteSpace: "pre-wrap" }}>{formatValue(v)}</span>
        </div>
      ))}
    </div>
  );
}

function formatValue(v) {
  if (v && typeof v === "object") {
    return JSON.stringify(v, null, 2);
  }
  return String(v);
}

const inp = { width: "100%" };

function renderStatusBadge(status) {
  const s = String(status || "pending");
  if (s === "approved") return <span className="badge ok">Одобрено</span>;
  if (s === "rejected") return <span className="badge off">Отклонено</span>;
  return <span className="badge warn">В ожидании</span>;
}

function sortObjectKeys(obj) {
  if (!obj || typeof obj !== "object") return {};
  return Object.keys(obj).sort().reduce((acc, key) => {
    acc[key] = obj[key];
    return acc;
  }, {});
}

function snapshotFromForm(form) {
  return {
    characterName: String(form.characterName || ""),
    classRole: String(form.classRole || ""),
    level: form.level === "" || form.level == null ? null : Number(form.level),
    stats: sortObjectKeys(form.stats || {}),
    bio: String(form.bio || ""),
    avatarUrl: String(form.avatarUrl || ""),
    editableFields: [...(form.editableFields || [])].sort(),
    allowRequests: !!form.allowRequests
  };
}

function snapshotFromProfile(profile) {
  if (!profile) return snapshotFromForm(emptyForm);
  return {
    characterName: String(profile.characterName || ""),
    classRole: String(profile.classRole || ""),
    level: profile.level == null ? null : Number(profile.level),
    stats: sortObjectKeys(profile.stats || {}),
    bio: String(profile.bio || ""),
    avatarUrl: String(profile.avatarUrl || ""),
    editableFields: [...(profile.editableFields || [])].sort(),
    allowRequests: !!profile.allowRequests
  };
}

function hasAnyData(form) {
  const f = snapshotFromForm(form);
  const hasText = f.characterName || f.classRole || f.bio || f.avatarUrl;
  const hasLevel = f.level !== null && f.level !== undefined;
  const hasStats = Object.keys(f.stats || {}).length > 0;
  const hasRights = f.editableFields.length > 0 || f.allowRequests;
  return !!(hasText || hasLevel || hasStats || hasRights);
}

function hasUnsavedChanges(form, profile) {
  if (!profile) return hasAnyData(form);
  return JSON.stringify(snapshotFromForm(form)) !== JSON.stringify(snapshotFromProfile(profile));
}

