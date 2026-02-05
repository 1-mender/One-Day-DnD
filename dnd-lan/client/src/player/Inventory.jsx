import React, { useCallback, useEffect, useMemo, useState } from "react";
import { api, storage } from "../api.js";
import Modal from "../components/Modal.jsx";
import InventoryItemCard from "../components/vintage/InventoryItemCard.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useQueryState } from "../hooks/useQueryState.js";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { ChevronDown, ChevronUp, Eye, EyeOff, LayoutGrid, List, Package, Plus, RefreshCcw, Scale } from "lucide-react";
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

export default function Inventory() {
  const toast = useToast();

  const [q, setQ] = useQueryState("q", "");
  const [vis, setVis] = useQueryState("vis", "");
  const [rarity, setRarity] = useQueryState("rarity", "");
  const [view, setView] = useQueryState("view", "list");
  const [tag, setTag] = useQueryState("tag", "");
  const [sort, setSort] = useQueryState("sort", "");
  const [stack, setStack] = useQueryState("stack", "");
  const [weightLimit, setWeightLimit] = useQueryState("wlimit", "");
  const [items, setItems] = useState([]);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const [expandedStacks, setExpandedStacks] = useState(() => new Set());
  const { socket } = useSocket();
  const lite = useLiteMode();
  const [listRef] = useAutoAnimate({ duration: lite ? 0 : 200 });
  const toggleStack = useCallback((key) => {
    if (!key) return;
    setExpandedStacks((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const readOnly = storage.isImpersonating() && storage.getImpMode() === "ro";
  const actionsVariant = lite || view === "grid" ? "compact" : "stack";

  const load = useCallback(async () => {
    setErr("");
    setLoading(true);
    try {
      const r = await api.invMine();
      setItems(r.items || []);
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

  const filtered = useMemo(() => filterInventory(items, { q, vis, rarity, tag }), [items, q, vis, rarity, tag]);
  const stackOn = stack === "1";
  const stackedItems = useMemo(() => (stackOn ? stackInventory(filtered) : filtered), [filtered, stackOn]);
  const displayItems = useMemo(() => sortInventory(stackedItems, sort), [stackedItems, sort]);
  const tagOptions = useMemo(() => collectTags(items), [items]);
  const { totalWeight: totalWeightAll } = useMemo(() => summarizeInventory(items), [items]);
  const limitValue = Number(weightLimit);
  const hasLimit = Number.isFinite(limitValue) && limitValue > 0;
  const overLimit = hasLimit && totalWeightAll > limitValue;
  const { totalWeight, publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
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
      const limit = Number(weightLimit);
      if (Number.isFinite(limit) && limit > 0) {
        const projected = projectTotalWeight(items, edit?.id, payload);
        if (projected > limit) {
          const msg = `\u041f\u0440\u0435\u0432\u044b\u0448\u0435\u043d \u043b\u0438\u043c\u0438\u0442 \u0432\u0435\u0441\u0430 (${limit}).`;
          setErr(msg);
          toast.warn(msg);
          return;
        }
      }
      if (edit) await api.invUpdateMine(edit.id, payload);
      else await api.invAddMine(payload);
      setOpen(false);
      await load();
      toast.success("Сохранено");
    } catch (e) {
      const msg = formatInventoryError(e);
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

  return (
    <div className={`card taped inventory-shell${lite ? " page-lite" : ""}`.trim()}>
      <div className="row" style={{ justifyContent:"space-between", alignItems:"center" }}>
        <div>
      <div style={{ fontWeight: 800, fontSize: 18 }}>Инвентарь</div>
      <div className="small">{"\u0412\u0435\u0441 (\u043f\u043e \u0444\u0438\u043b\u044c\u0442\u0440\u0443):"} {totalWeight.toFixed(2)}{hasLimit ? ` / ${limitValue}` : ""} {readOnly ? "\u2022 read-only" : ""}</div>
        </div>
        <button className="btn" onClick={startAdd} disabled={readOnly}><Plus className="icon" aria-hidden="true" />Добавить</button>
      </div>
      <hr />
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
        <select value={tag} onChange={(e)=>setTag(e.target.value)}>
          <option value="">Теги: все</option>
          {tagOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <select value={sort} onChange={(e)=>setSort(e.target.value)}>
          <option value="">Сортировка: по умолчанию</option>
          <option value="name">По названию</option>
          <option value="weight">По весу</option>
          <option value="rarity">По редкости</option>
          <option value="qty">По количеству</option>
        </select>
        <input
          type="number"
          min="0"
          step="0.01"
          value={weightLimit}
          onChange={(e)=>setWeightLimit(e.target.value)}
          placeholder="Лимит веса"
        />
        <button className={`btn ${stackOn ? "" : "secondary"}`} onClick={() => setStack(stackOn ? "" : "1")}>
          {"Стек"}
        </button>
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
          <span className="badge"><Package className="icon" aria-hidden="true" />{"\u0412\u0441\u0435\u0433\u043e:"} {displayItems.length}</span>
          <span className="badge ok"><Eye className="icon" aria-hidden="true" />{"\u041f\u0443\u0431\u043b\u0438\u0447\u043d\u044b\u0435:"} {publicCount}</span>
          <span className="badge off"><EyeOff className="icon" aria-hidden="true" />{"\u0421\u043a\u0440\u044b\u0442\u044b\u0435:"} {hiddenCount}</span>
          <span className="badge secondary"><Scale className="icon" aria-hidden="true" />{"\u0412\u0435\u0441:"} {totalWeight.toFixed(2)}</span>
          {hasLimit ? (
            <span className={`badge ${overLimit ? "off" : "secondary"}`}>{"\u041b\u0438\u043c\u0438\u0442:"} {limitValue}</span>
          ) : null}
          {stackOn ? <span className="badge secondary">{"\u0421\u0442\u0435\u043a"}</span> : null}
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
        ) : displayItems.length === 0 ? (
          <EmptyState
            title={hasAny ? "Ничего не найдено" : "Инвентарь пуст"}
            hint={hasAny ? "Попробуйте изменить фильтры или поиск." : "Добавьте предмет, чтобы начать."}
          />
        ) : (
          <div className={`list inv-shelf ${view === "grid" ? "inv-grid" : ""}`} ref={lite ? null : listRef}>
            {displayItems.map((it) => {
              if (!stackOn) {
                return (
                  <InventoryItemCard
                    key={it.stackKey || it.id}
                    item={it}
                    readOnly={readOnly}
                    actionsVariant={actionsVariant}
                    lite={lite}
                    onEdit={() => startEdit(it)}
                    onDelete={() => del(it.id)}
                    onToggleVisibility={() => toggleVisibility(it)}
                  />
                );
              }
              const stackItems = Array.isArray(it.stackItems) ? it.stackItems : [];
              const isGrouped = stackItems.length > 1;
              if (!isGrouped) {
                const single = stackItems[0] || it;
                return (
                  <InventoryItemCard
                    key={it.stackKey || single.id || it.id}
                    item={single}
                    readOnly={readOnly}
                    actionsVariant={actionsVariant}
                    lite={lite}
                    onEdit={() => startEdit(single)}
                    onDelete={() => del(single.id)}
                    onToggleVisibility={() => toggleVisibility(single)}
                  />
                );
              }
              const stackKey = it.stackKey || `${it.name || ""}-${it.rarity || ""}-${it.visibility || ""}`;
              const expanded = expandedStacks.has(stackKey);
              return (
                <div key={stackKey} className="inv-stack-group">
                  <InventoryItemCard
                    item={{ ...it, description: "" }}
                    readOnly
                    actionsVariant={actionsVariant}
                    lite={lite}
                  />
                  <div className="inv-stack-toggle">
                    <span className="badge secondary">{`\u0412 \u0433\u0440\u0443\u043f\u043f\u0435: ${stackItems.length}`}</span>
                    <button
                      className="btn secondary"
                      onClick={() => toggleStack(stackKey)}
                      aria-expanded={expanded}
                      aria-label={expanded ? "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0441\u0442\u0435\u043a" : "\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c \u0441\u0442\u0435\u043a"}
                    >
                      {expanded ? <ChevronUp className="icon" aria-hidden="true" /> : <ChevronDown className="icon" aria-hidden="true" />}
                      {expanded ? "\u0421\u0432\u0435\u0440\u043d\u0443\u0442\u044c" : "\u0420\u0430\u0437\u0432\u0435\u0440\u043d\u0443\u0442\u044c"}
                    </button>
                  </div>
                  {expanded ? (
                    <div className="inv-stack-items">
                      {stackItems.map((child) => (
                        <InventoryItemCard
                          key={child.id}
                          item={child}
                          readOnly={readOnly}
                          actionsVariant={actionsVariant}
                          lite={lite}
                          onEdit={() => startEdit(child)}
                          onDelete={() => del(child.id)}
                          onToggleVisibility={() => toggleVisibility(child)}
                        />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
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

function filterInventory(items, { q, vis, rarity, tag }) {
  const list = items || [];
  const qq = String(q || "").toLowerCase().trim();
  const tagValue = String(tag || "").toLowerCase().trim();
  return list.filter((it) => {
    if (vis && String(it.visibility) !== vis) return false;
    if (rarity && String(it.rarity || "") !== rarity) return false;
    if (tagValue) {
      const tags = stripIconTags(Array.isArray(it.tags) ? it.tags.filter(Boolean) : [])
        .map((t) => String(t).toLowerCase());
      if (!tags.includes(tagValue)) return false;
    }
    if (!qq) return true;
    return String(it.name || "").toLowerCase().includes(qq);
  });
}

function collectTags(items) {
  const out = new Set();
  for (const it of items || []) {
    const tags = stripIconTags(Array.isArray(it.tags) ? it.tags.filter(Boolean) : []);
    for (const t of tags) out.add(String(t));
  }
  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

function stackInventory(items) {
  const map = new Map();
  for (const it of items || []) {
    const rawTags = Array.isArray(it.tags) ? it.tags.filter(Boolean) : [];
    const tags = stripIconTags(rawTags);
    const key = [
      String(it.name || "").toLowerCase().trim(),
      String(it.rarity || "").toLowerCase(),
      String(it.visibility || ""),
      String(Number(it.weight || 0)),
      tags.map((t) => String(t).toLowerCase()).sort().join("|")
    ].join("::");
    const qty = Number(it.qty) || 1;
    if (map.has(key)) {
      const existing = map.get(key);
      existing.qty += qty;
      existing.stackItems.push(it);
      if (Number(it.updated_at || 0) > Number(existing.updated_at || 0)) {
        existing.updated_at = it.updated_at;
        existing.updated_by = it.updated_by;
      }
    } else {
      map.set(key, { ...it, tags: rawTags, stackKey: key, qty, stackItems: [it] });
    }
  }
  return Array.from(map.values());
}

function sortInventory(items, sortKey) {
  const list = Array.isArray(items) ? items.slice() : [];
  if (!sortKey) return list;
  const rarityOrder = RARITY_OPTIONS.reduce((acc, opt, idx) => {
    acc[opt.value] = idx;
    return acc;
  }, {});
  list.sort((a, b) => {
    if (sortKey === "name") return String(a.name || "").localeCompare(String(b.name || ""));
    if (sortKey === "weight") return (Number(b.weight || 0) * Number(b.qty || 1)) - (Number(a.weight || 0) * Number(a.qty || 1));
    if (sortKey === "qty") return Number(b.qty || 0) - Number(a.qty || 0);
    if (sortKey === "rarity") {
      const ra = rarityOrder[String(a.rarity || "")] ?? 999;
      const rb = rarityOrder[String(b.rarity || "")] ?? 999;
      return ra - rb;
    }
    return 0;
  });
  return list;
}

function projectTotalWeight(items, editingId, nextItem) {
  let total = 0;
  for (const it of items || []) {
    if (editingId && it.id === editingId) continue;
    const qty = Number(it.qty) || 1;
    const weight = Number(it.weight) || 0;
    total += weight * qty;
  }
  if (nextItem) {
    const qty = Number(nextItem.qty) || 1;
    const weight = Number(nextItem.weight) || 0;
    total += weight * qty;
  }
  return total;
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

function formatInventoryError(err) {
  const code = err?.body?.error || err?.error || err?.message;
  if (code === "weight_limit_exceeded") {
    const limit = Number(err?.body?.limit);
    if (Number.isFinite(limit) && limit > 0) {
      return `\u041f\u0440\u0435\u0432\u044b\u0448\u0435\u043d \u043b\u0438\u043c\u0438\u0442 \u0432\u0435\u0441\u0430 (${limit}).`;
    }
    return "\u041f\u0440\u0435\u0432\u044b\u0448\u0435\u043d \u043b\u0438\u043c\u0438\u0442 \u0432\u0435\u0441\u0430.";
  }
  return formatError(err);
}



