import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, storage } from "../api.js";
import Modal from "../components/Modal.jsx";
import InventoryItemCard, { pickInventoryIcon } from "../components/vintage/InventoryItemCard.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useQueryState } from "../hooks/useQueryState.js";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Eye, EyeOff, LayoutGrid, List, Package, Plus, RefreshCcw, Scale } from "lucide-react";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import { formatError } from "../lib/formatError.js";
import { useLiteMode } from "../hooks/useLiteMode.js";
import {
  INVENTORY_ICON_SECTIONS,
  applyIconTag,
  getIconKeyFromItem,
  getInventoryIcon,
  stripIconTags
} from "../lib/inventoryIcons.js";
import { RARITY_OPTIONS } from "../lib/inventoryRarity.js";
import { useSocket } from "../context/SocketContext.jsx";

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public", iconKey:"" };
const FAVORITE_TAG = "favorite";
const ENV_MAX_WEIGHT = Number(import.meta.env.VITE_INVENTORY_WEIGHT_LIMIT || 0);

export default function Inventory() {
  const toast = useToast();

  const [q, setQ] = useQueryState("q", "");
  const [vis, setVis] = useQueryState("vis", "");
  const [rarity, setRarity] = useQueryState("rarity", "");
  const [view, setView] = useQueryState("view", "list");
  const [items, setItems] = useState([]);
  const [maxWeight, setMaxWeight] = useState(ENV_MAX_WEIGHT);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();
  const lite = useLiteMode();
  const [listRef] = useAutoAnimate({ duration: lite ? 0 : 200 });

  const readOnly = storage.isImpersonating() && storage.getImpMode() === "ro";
  const actionsVariant = lite || view === "grid" ? "compact" : "stack";

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await api.invMine();
      setItems(r.items || []);
      const limit = Number(r?.weightLimit);
      if (Number.isFinite(limit)) {
        setMaxWeight((prev) => (prev === limit ? prev : limit));
      }
    } catch (e) {
      setErr(formatError(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onUpdated = () => load().catch(() => {});
    socket.on("inventory:updated", onUpdated);
    return () => {
      socket.off("inventory:updated", onUpdated);
    };
  }, [load, socket]);


  const filtered = useMemo(() => filterInventory(items, { q, vis, rarity }), [items, q, vis, rarity]);
  const { totalWeight, publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
  const { totalWeight: totalWeightAll } = useMemo(() => summarizeInventory(items), [items]);
  const favorites = useMemo(
    () => items.filter((it) => Array.isArray(it.tags) && it.tags.includes(FAVORITE_TAG)),
    [items]
  );
  const hasAny = items.length > 0;
  const SelectedIcon = getInventoryIcon(form.iconKey);

  function startAdd() {
    if (readOnly) return;
    setEdit(null);
    setForm(empty);
    setOpen(true);
  }
  function startEdit(it) {
    if (readOnly) return;
    setEdit(it);
    const rest = { ...(it || {}) };
    delete rest.imageUrl;
    delete rest.image_url;
    setForm({
      ...rest,
      tags: stripIconTags(it.tags || []),
      iconKey: getIconKeyFromItem(it)
    });
    setOpen(true);
  }

  async function save() {
    if (readOnly) return;
    setErr("");
    try {
      if (!form.name.trim()) return;
      const { iconKey, ...rest } = form;
      const payload = {
        ...rest,
        qty: Number(rest.qty),
        weight: Number(rest.weight),
        tags: applyIconTag((rest.tags || []).filter(Boolean), iconKey)
      };
      if (edit) await api.invUpdateMine(edit.id, payload);
      else await api.invAddMine(payload);
      setOpen(false);
      await load();
      toast.success("Сохранено");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }
  async function del(id) {
    if (readOnly) return;
    setErr("");
    try {
      await api.invDeleteMine(id);
      await load();
      toast.success("Удалено");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  async function toggleVisibility(it) {
    if (readOnly) return;
    try {
      const next = it.visibility === "hidden" ? "public" : "hidden";
      await api.invUpdateMine(it.id, { ...it, visibility: next, tags: it.tags || [] });
      toast.success(`Видимость: ${next === "public" ? "Публичный" : "Скрытый"}`);
      await load();
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  async function toggleFavorite(it) {
    if (readOnly) return;
    try {
      const nextTags = Array.isArray(it.tags) ? [...it.tags] : [];
      const idx = nextTags.indexOf(FAVORITE_TAG);
      if (idx >= 0) nextTags.splice(idx, 1);
      else nextTags.push(FAVORITE_TAG);
      await api.invUpdateMine(it.id, { ...it, tags: nextTags });
      toast.success(idx >= 0 ? "Убрано из избранного" : "Добавлено в избранное");
      await load();
    } catch (e) {
      toast.error(formatError(e));
    }
  }

  const hasWeightLimit = Number.isFinite(maxWeight) && maxWeight > 0;
  const weightRatio = hasWeightLimit ? totalWeightAll / maxWeight : 0;
  const weightStatus = hasWeightLimit ? (weightRatio >= 1 ? "off" : weightRatio >= 0.75 ? "warn" : "ok") : "secondary";

  return (
    <div className={`card taped inventory-shell${lite ? " page-lite" : ""}`.trim()}>
      <div className="inv-head">
        <div className="inv-head-main">
      <div style={{ fontWeight: 800, fontSize: 18 }}>Инвентарь</div>
      <div className="small">Вес (по фильтру): {totalWeight.toFixed(2)} {readOnly ? "• read-only" : ""}</div>
        </div>
        <button className="btn" onClick={startAdd} disabled={readOnly}><Plus className="icon" aria-hidden="true" />Добавить</button>
      </div>
      <hr />

      {favorites.length ? (
        <div className="inv-quick-bar">
          <div className="inv-quick-title">??????? ?????</div>
          <div className="inv-quick-list">
            {favorites.map((it) => {
              const icon = pickInventoryIcon(it);
              const qty = Number(it.qty) || 1;
              return (
                <button
                  key={`fav_${it.id}`}
                  type="button"
                  className="inv-quick-item"
                  onClick={() => startEdit(it)}
                  disabled={readOnly}
                  title={`${it.name || ""} x${qty}`}
                  aria-label={`${it.name || "Item"} x${qty}`}
                >
                  {icon.Icon ? (
                    <icon.Icon className="inv-quick-icon" aria-hidden="true" />
                  ) : (
                    <span className="inv-quick-fallback">{icon.text}</span>
                  )}
                  <span className="inv-quick-qty">x{qty}</span>
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="small inv-quick-empty">
          ???????? ?????/?????? ??? ?????????, ????? ??? ????????? ? ??????? ??????.
        </div>
      )}
      <div className="inv-toolbar">
        <input value={q} onChange={(e)=>setQ(e.target.value)} placeholder="Поиск по названию..." />
        <select value={vis} onChange={(e)=>setVis(e.target.value)}>
          <option value="">Видимость: все</option>
          <option value="public">Публичные</option>
          <option value="hidden">Скрытые</option>
        </select>
        <select value={rarity} onChange={(e)=>setRarity(e.target.value)}>
          <option value="">Редкость: все</option>
          {RARITY_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
        <button className={`btn ${view === "list" ? "" : "secondary"}`} onClick={() => setView("list")}>
          <List className="icon" aria-hidden="true" />Список
        </button>
        <button className={`btn ${view === "grid" ? "" : "secondary"}`} onClick={() => setView("grid")}>
          <LayoutGrid className="icon" aria-hidden="true" />Плитка
        </button>
        <button className="btn secondary" onClick={load}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
      </div>

      <div className="small" style={{ marginTop: 10 }}>
        <div className="row" style={{ flexWrap: "wrap" }}>
          <span className="badge"><Package className="icon" aria-hidden="true" />Всего: {filtered.length}</span>
          <span className="badge ok"><Eye className="icon" aria-hidden="true" />Публичные: {publicCount}</span>
          <span className="badge off"><EyeOff className="icon" aria-hidden="true" />Скрытые: {hiddenCount}</span>
          <span className={`badge ${weightStatus}`}>
            <Scale className="icon" aria-hidden="true" />
            Вес: {totalWeightAll.toFixed(2)} {hasWeightLimit ? ` / ${maxWeight}` : " / \u221e"}
          </span>
          {readOnly ? <span className="badge warn">read-only</span> : null}
        </div>
      </div>

      <div style={{ marginTop: 12 }}>
        <ErrorBanner message={err} onRetry={load} />

        {loading ? (
          <div className="list">
            <div className="item"><Skeleton h={86} w="100%" /></div>
            <div className="item"><Skeleton h={86} w="100%" /></div>
            <div className="item"><Skeleton h={86} w="100%" /></div>
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            title={hasAny ? "Ничего не найдено" : "Инвентарь пуст"}
            hint={hasAny ? "Попробуйте изменить фильтры или поиск." : "Добавьте предмет, чтобы начать."}
          />
        ) : (
          <div className={`list inv-shelf ${view === "grid" ? "inv-grid" : ""}`} ref={lite ? null : listRef}>
            {filtered.map((it) => (
              <InventoryItemCard
                key={it.id}
                item={it}
                readOnly={readOnly}
                actionsVariant={actionsVariant}
                lite={lite}
                onEdit={() => startEdit(it)}
                onDelete={() => del(it.id)}
                onToggleVisibility={() => toggleVisibility(it)}
                onToggleFavorite={() => toggleFavorite(it)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={open} title={edit ? "Редактировать предмет" : "Новый предмет"} onClose={() => setOpen(false)}>
        <div className="list">
          <input value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} placeholder="Название*" style={inp} />
          <textarea value={form.description} onChange={(e)=>setForm({ ...form, description: e.target.value })} placeholder="Описание" rows={4} style={inp} />
          <div className="row">
            <input value={form.qty} onChange={(e)=>setForm({ ...form, qty: e.target.value })} placeholder="Количество" style={inp} />
            <input value={form.weight} onChange={(e)=>setForm({ ...form, weight: e.target.value })} placeholder="Вес" style={inp} />
          </div>
          <div className="row">
            <select value={form.rarity} onChange={(e)=>setForm({ ...form, rarity: e.target.value })} style={inp}>
              {RARITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select value={form.visibility} onChange={(e)=>setForm({ ...form, visibility: e.target.value })} style={inp}>
              <option value="public">Public</option>
              <option value="hidden">Hidden</option>
            </select>
          </div>
          <div className="row" style={{ alignItems: "center" }}>
            <select
              value={form.iconKey || ""}
              onChange={(e)=>setForm({ ...form, iconKey: e.target.value })}
              style={inp}>
              <option value="">{"\u0418\u043a\u043e\u043d\u043a\u0430: \u043d\u0435\u0442"}</option>
              {INVENTORY_ICON_SECTIONS.map((section) => (
                <optgroup key={section.key} label={section.label}>
                  {section.items.map((icon) => (
                    <option key={icon.key} value={icon.key}>{icon.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
            <div className="badge secondary" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {SelectedIcon ? (
                <SelectedIcon className="inv-icon" aria-hidden="true" style={{ width: 28, height: 28 }} />
              ) : (
                <span className="small">{"\u0411\u0435\u0437 \u0438\u043a\u043e\u043d\u043a\u0438"}</span>
              )}
            </div>
          </div>
          <input
            value={(form.tags || []).join(", ")}
            onChange={(e)=>setForm({ ...form, tags: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })}
            placeholder="Теги (через запятую)"
            style={inp}
          />
          <button className="btn" onClick={save}>Сохранить</button>
        </div>
      </Modal>
    </div>
  );
}

const inp = { width: "100%" };

function filterInventory(items, { q, vis, rarity }) {
  const list = items || [];
  const qq = String(q || "").toLowerCase().trim();
  return list.filter((it) => {
    if (vis && String(it.visibility) !== vis) return false;
    if (rarity && String(it.rarity || "") !== rarity) return false;
    if (!qq) return true;
    return String(it.name || "").toLowerCase().includes(qq);
  });
}

function summarizeInventory(list) {
  return (list || []).reduce((acc, it) => {
    const qty = Number(it.qty) || 1;
    const weight = Number(it.weight) || 0;
    acc.totalWeight += weight * qty;
    if (String(it.visibility) === "hidden") acc.hiddenCount += 1;
    else acc.publicCount += 1;
    return acc;
  }, { totalWeight: 0, publicCount: 0, hiddenCount: 0 });
}



