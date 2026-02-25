import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api.js";
import Modal from "../components/Modal.jsx";
import InventoryItemCard, { pickInventoryIcon } from "../components/vintage/InventoryItemCard.jsx";
import InventorySlotGrid from "./InventorySlotGrid.jsx";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { useQueryState } from "../hooks/useQueryState.js";
import { useAutoAnimate } from "@formkit/auto-animate/react";
import { Eye, EyeOff, Grid3x3, LayoutGrid, List, Package, Plus, RefreshCcw, Scale, Send } from "lucide-react";
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
import { useReadOnly } from "../hooks/useReadOnly.js";
import { getItemAvailableQty, getSplitInputMax } from "./inventoryDomain.js";

const empty = { name:"", description:"", qty:1, weight:0, rarity:"common", tags:[], visibility:"public", iconKey:"" };
const FAVORITE_TAG = "favorite";
const ENV_MAX_WEIGHT = Number(import.meta.env.VITE_INVENTORY_WEIGHT_LIMIT || 0);

export default function Inventory() {
  const nav = useNavigate();
  const toast = useToast();

  const [q, setQ] = useQueryState("q", "");
  const [vis, setVis] = useQueryState("vis", "");
  const [rarity, setRarity] = useQueryState("rarity", "");
  const [view, setView] = useQueryState("view", "list");
  const [items, setItems] = useState([]);
  const [players, setPlayers] = useState([]);
  const [maxWeight, setMaxWeight] = useState(ENV_MAX_WEIGHT);
  const [open, setOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [form, setForm] = useState(empty);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferItem, setTransferItem] = useState(null);
  const [transferTo, setTransferTo] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transferNote, setTransferNote] = useState("");
  const [splitOpen, setSplitOpen] = useState(false);
  const [splitItem, setSplitItem] = useState(null);
  const [splitQty, setSplitQty] = useState(1);
  const [splitTarget, setSplitTarget] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();
  const lite = useLiteMode();
  const [listRef] = useAutoAnimate({ duration: lite ? 0 : 200 });
  const [iconQuery, setIconQuery] = useState("");
  const [iconPickerOpen, setIconPickerOpen] = useState(false);
  const [layoutSaving, setLayoutSaving] = useState(false);

  const readOnly = useReadOnly();
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

  const loadPlayers = useCallback(async () => {
    try {
      const [meRes, listRes] = await Promise.all([api.me(), api.players()]);
      const meId = meRes?.player?.id ?? null;
      const list = Array.isArray(listRes?.items) ? listRes.items : [];
      setPlayers(list.filter((p) => p.id !== meId));
    } catch {
      setPlayers([]);
    }
  }, []);

  useEffect(() => {
    if (!socket) return () => {};
    load().catch(() => {});
    const onUpdated = () => load().catch(() => {});
    const onProfile = () => load().catch(() => {});
    socket.on("inventory:updated", onUpdated);
    socket.on("profile:updated", onProfile);
    return () => {
      socket.off("inventory:updated", onUpdated);
      socket.off("profile:updated", onProfile);
    };
  }, [load, socket]);

  useEffect(() => {
    if (transferOpen && !transferTo && players.length) {
      setTransferTo(String(players[0].id));
    }
  }, [transferOpen, transferTo, players]);

  useEffect(() => {
    if (iconQuery) setIconPickerOpen(true);
  }, [iconQuery]);

  useEffect(() => {
    if (!open) {
      setIconQuery("");
      setIconPickerOpen(false);
    }
  }, [open]);


  const filtered = useMemo(() => filterInventory(items, { q, vis, rarity }), [items, q, vis, rarity]);
  const { totalWeight, publicCount, hiddenCount } = useMemo(() => summarizeInventory(filtered), [filtered]);
  const { totalWeight: totalWeightAll } = useMemo(() => summarizeInventory(items), [items]);
  const favorites = useMemo(
    () => items.filter((it) => Array.isArray(it.tags) && it.tags.includes(FAVORITE_TAG)),
    [items]
  );
  const filteredIconSections = useMemo(
    () => filterIconSections(INVENTORY_ICON_SECTIONS, iconQuery),
    [iconQuery]
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
    delete rest.reservedQty;
    delete rest.reserved_qty;
    setForm({
      ...rest,
      tags: stripIconTags(it.tags || []),
      iconKey: getIconKeyFromItem(it)
    });
    setOpen(true);
  }
  function startTransfer(it) {
    if (readOnly) return;
    const available = getItemAvailableQty(it);
    if (available <= 0) {
      toast.warn("Нет доступного количества для передачи");
      return;
    }
    setTransferItem(it);
    setTransferQty(Math.min(available, 1));
    setTransferTo("");
    setTransferNote("");
    setTransferOpen(true);
    if (!players.length) loadPlayers().catch(() => {});
  }

  function startSplit(it, targetSlot = null) {
    if (readOnly) return;
    const available = getItemAvailableQty(it);
    if (available < 2) {
      toast.warn("Недостаточно количества для разделения");
      return;
    }
    setSplitItem(it);
    setSplitQty(1);
    setSplitTarget(targetSlot && Number.isInteger(targetSlot.slotX) && Number.isInteger(targetSlot.slotY)
      ? {
          container: String(targetSlot.container || "backpack"),
          slotX: Number(targetSlot.slotX),
          slotY: Number(targetSlot.slotY)
        }
      : null);
    setSplitOpen(true);
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

  async function sendTransfer() {
    if (readOnly || !transferItem) return;
    const qty = Number(transferQty);
    const available = getItemAvailableQty(transferItem);
    if (!Number.isFinite(qty) || qty < 1 || qty > 9999) {
      toast.error("Некорректное количество");
      return;
    }
    if (qty > available) {
      toast.error("Количество превышает доступное");
      return;
    }
    if (!transferTo) {
      toast.error("Выберите получателя");
      return;
    }
    if (String(transferNote || "").length > 140) {
      toast.error("Сообщение слишком длинное");
      return;
    }
    setErr("");
    try {
      await api.invTransferCreate({
        to_player_id: Number(transferTo),
        item_id: transferItem.id,
        qty,
        note: transferNote
      });
      setTransferOpen(false);
      await load();
      toast.success("Передача отправлена");
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

  async function moveLayoutItems(moves) {
    if (readOnly || !Array.isArray(moves) || !moves.length) return;
    const snapshot = items;
    setLayoutSaving(true);
    setItems((current) => applyLayoutMoves(current, moves));
    try {
      await api.invLayoutUpdateMine(moves);
    } catch (e) {
      setItems(snapshot);
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
      await load();
    } finally {
      setLayoutSaving(false);
    }
  }

  async function quickEquip(it) {
    if (readOnly || !it?.id) return;
    setErr("");
    try {
      const result = await api.invQuickEquipMine(it.id);
      if (result?.idempotent) toast.info("Уже экипировано");
      else toast.success("Экипировано");
      await load();
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  async function confirmSplit() {
    if (readOnly || !splitItem) return;
    const available = getItemAvailableQty(splitItem);
    const qty = Math.floor(Number(splitQty));
    if (!Number.isFinite(qty) || qty < 1 || qty >= available) {
      toast.error("Некорректное количество для разделения");
      return;
    }
    setErr("");
    try {
      const payload = { qty };
      if (splitTarget && Number.isInteger(splitTarget.slotX) && Number.isInteger(splitTarget.slotY)) {
        payload.container = splitTarget.container;
        payload.slotX = splitTarget.slotX;
        payload.slotY = splitTarget.slotY;
      }
      await api.invSplitMine(splitItem.id, payload);
      setSplitOpen(false);
      setSplitItem(null);
      setSplitTarget(null);
      await load();
      toast.success("Стак разделен");
    } catch (e) {
      const msg = formatError(e);
      setErr(msg);
      toast.error(msg);
    }
  }

  const hasWeightLimit = Number.isFinite(maxWeight) && maxWeight > 0;
  const weightRatio = hasWeightLimit ? totalWeightAll / maxWeight : 0;
  const weightStatus = hasWeightLimit ? (weightRatio >= 1 ? "off" : weightRatio >= 0.75 ? "warn" : "ok") : "secondary";
  const transferAvailable = transferItem ? getItemAvailableQty(transferItem) : 0;
  const transferInputMax = Math.max(1, Math.min(9999, transferAvailable || 1));
  const splitAvailable = splitItem ? getItemAvailableQty(splitItem) : 0;

  return (
    <div className={`card inventory-shell${lite ? " page-lite" : ""}`.trim()}>
      <div className="inv-header">
        <div className="inv-header-main">
          <div className="inv-title-lg">Инвентарь</div>
          <div className="inv-subtitle">
            Вес (по фильтру): {totalWeight.toFixed(2)}
            {readOnly ? <span className="badge warn">read-only</span> : null}
          </div>
        </div>
        <div className="inv-header-actions">
          <button className="btn secondary" onClick={() => nav("/app/transfers")}>Передачи</button>
          <button className="btn" onClick={startAdd} disabled={readOnly}><Plus className="icon" aria-hidden="true" />Добавить</button>
          <button className="btn secondary" onClick={load}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
        </div>
      </div>

      <div className="inv-stats">
        <div className="inv-stat">
          <Package className="icon" aria-hidden="true" />
          <div>
            <div className="inv-stat-label">Всего</div>
            <div className="inv-stat-value">{filtered.length}</div>
          </div>
        </div>
        <div className="inv-stat">
          <Eye className="icon" aria-hidden="true" />
          <div>
            <div className="inv-stat-label">Публичные</div>
            <div className="inv-stat-value">{publicCount}</div>
          </div>
        </div>
        <div className="inv-stat">
          <EyeOff className="icon" aria-hidden="true" />
          <div>
            <div className="inv-stat-label">Скрытые</div>
            <div className="inv-stat-value">{hiddenCount}</div>
          </div>
        </div>
        <div className={`inv-stat ${weightStatus}`}>
          <Scale className="icon" aria-hidden="true" />
          <div>
            <div className="inv-stat-label">Вес</div>
            <div className="inv-stat-value">
              {totalWeightAll.toFixed(2)} {hasWeightLimit ? ` / ${maxWeight}` : " / \u221e"}
            </div>
          </div>
        </div>
      </div>

      <div className="inv-panel inv-filters">
        <div className="inv-panel-head">
          <div className="inv-panel-title">Фильтры</div>
          <div className="inv-view-toggle">
            <button className={`btn ${view === "list" ? "" : "secondary"}`} onClick={() => setView("list")}>
              <List className="icon" aria-hidden="true" />Список
            </button>
            <button className={`btn ${view === "grid" ? "" : "secondary"}`} onClick={() => setView("grid")}>
              <LayoutGrid className="icon" aria-hidden="true" />Плитка
            </button>
            <button className={`btn ${view === "slots" ? "" : "secondary"}`} onClick={() => setView("slots")}>
              <Grid3x3 className="icon" aria-hidden="true" />RPG
            </button>
          </div>
        </div>
        <div className="inv-filter-row">
          <input
            value={q}
            onChange={(e)=>setQ(e.target.value)}
            placeholder="Поиск по названию..."
            aria-label="Поиск предметов по названию"
          />
          <select value={vis} onChange={(e)=>setVis(e.target.value)} aria-label="Фильтр по видимости">
            <option value="">Видимость: все</option>
            <option value="public">Публичные</option>
            <option value="hidden">Скрытые</option>
          </select>
          <select value={rarity} onChange={(e)=>setRarity(e.target.value)} aria-label="Фильтр по редкости">
            <option value="">Редкость: все</option>
            {RARITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="inv-panel inv-favorites">
        <div className="inv-panel-head">
          <div className="inv-panel-title">Избранное</div>
          <div className="small">Быстрые слоты предметов</div>
        </div>
        {favorites.length ? (
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
        ) : (
          <div className="small inv-quick-empty">
            Добавьте предмет в избранное, чтобы он появился в быстрых слотах.
          </div>
        )}
      </div>

      <div className="inv-panel inv-items">
        <div className="inv-panel-head">
          <div className="inv-panel-title">Предметы</div>
          <div className="small">Все предметы инвентаря</div>
        </div>
        <ErrorBanner message={err} onRetry={load} />

        {loading ? (
          <div className="list">
            <div className="item"><Skeleton h={86} w="100%" /></div>
            <div className="item"><Skeleton h={86} w="100%" /></div>
            <div className="item"><Skeleton h={86} w="100%" /></div>
          </div>
        ) : view === "slots" ? (
          filtered.length === 0 ? (
            <EmptyState
              title={hasAny ? "Ничего не найдено" : "Инвентарь пуст"}
              hint={hasAny ? "Попробуйте изменить фильтры или поиск." : "Добавьте предмет, чтобы начать."}
            />
          ) : (
            <InventorySlotGrid
              items={filtered}
              readOnly={readOnly}
              busy={layoutSaving}
              onMove={moveLayoutItems}
              onItemOpen={(item) => startEdit(item)}
              onTransferItem={(item) => startTransfer(item)}
              onToggleFavoriteItem={(item) => toggleFavorite(item)}
              onDeleteItem={(item) => del(item.id)}
              onSplitItem={(item, targetSlot, targetItem) => {
                if (targetItem) {
                  toast.warn("Для разделения нужен пустой слот");
                  return;
                }
                startSplit(item, targetSlot);
              }}
              onQuickEquipItem={(item) => quickEquip(item)}
            />
          )
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
                onTransfer={() => startTransfer(it)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal open={open} title={edit ? "Редактировать предмет" : "Новый предмет"} onClose={() => setOpen(false)}>
        <div className="list">
          <input value={form.name} onChange={(e)=>setForm({ ...form, name: e.target.value })} placeholder="Название*" aria-label="Название предмета" style={inp} />
          <textarea value={form.description} onChange={(e)=>setForm({ ...form, description: e.target.value })} placeholder="Описание" aria-label="Описание предмета" rows={4} style={inp} />
          <div className="row">
            <input value={form.qty} onChange={(e)=>setForm({ ...form, qty: e.target.value })} placeholder="Количество" aria-label="Количество предмета" style={inp} />
            <input value={form.weight} onChange={(e)=>setForm({ ...form, weight: e.target.value })} placeholder="Вес" aria-label="Вес предмета" style={inp} />
          </div>
          <div className="row">
            <select value={form.rarity} onChange={(e)=>setForm({ ...form, rarity: e.target.value })} aria-label="Редкость" style={inp}>
              {RARITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <select value={form.visibility} onChange={(e)=>setForm({ ...form, visibility: e.target.value })} aria-label="Видимость" style={inp}>
              <option value="public">Публичные</option>
              <option value="hidden">Скрытые</option>
            </select>
          </div>
          <div className="row" style={{ alignItems: "center" }}>
            <select
              value={form.iconKey || ""}
              onChange={(e)=>setForm({ ...form, iconKey: e.target.value })}
              aria-label="Иконка предмета"
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
          <details
            className="inv-icon-picker"
            open={iconPickerOpen}
            onToggle={(e) => setIconPickerOpen(e.currentTarget.open)}
          >
            <summary>Иконки предметов</summary>
            <div className="inv-icon-toolbar">
              <input
                value={iconQuery}
                onChange={(e) => setIconQuery(e.target.value)}
                placeholder="Поиск иконок..."
                aria-label="Поиск иконок предмета"
                className="inv-icon-search"
              />
            </div>
            {filteredIconSections.length ? (
              <div className="inv-icon-grid">
                {filteredIconSections.map((section) => (
                  <div key={section.key} className="inv-icon-section">
                    <div className="inv-icon-section-title">{section.label}</div>
                    <div className="inv-icon-section-grid">
                      {section.items.map((icon) => {
                        const Icon = icon.Icon;
                        const active = form.iconKey === icon.key;
                        return (
                          <button
                            key={icon.key}
                            type="button"
                            className={`inv-icon-tile${active ? " active" : ""}`}
                            onClick={() => setForm({ ...form, iconKey: icon.key })}
                            title={icon.label}
                            aria-pressed={active}
                          >
                            <Icon className="inv-icon" aria-hidden="true" />
                            <span>{icon.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="small inv-icon-empty">Ничего не найдено.</div>
            )}
          </details>
          <input
            value={(form.tags || []).join(", ")}
            onChange={(e)=>setForm({ ...form, tags: e.target.value.split(",").map(s=>s.trim()).filter(Boolean) })}
            placeholder="Теги (через запятую)"
            aria-label="Теги предмета через запятую"
            style={inp}
          />
          <button className="btn" onClick={save}>Сохранить</button>
        </div>
      </Modal>

      <Modal open={transferOpen} title="Передать предмет" onClose={() => setTransferOpen(false)}>
        <div className="list">
          {transferItem ? (
            <div className="small note-hint">
              <b>{transferItem.name}</b> • доступно: {transferAvailable}
            </div>
          ) : null}
          <select value={transferTo} onChange={(e) => setTransferTo(e.target.value)} aria-label="Получатель передачи" style={inp}>
            <option value="">Выберите получателя</option>
            {players.map((p) => (
              <option key={p.id} value={p.id}>{p.displayName} (id:{p.id})</option>
            ))}
          </select>
          <input
            type="number"
            min={1}
            max={transferInputMax}
            value={transferQty}
            onChange={(e) => setTransferQty(e.target.value)}
            placeholder="Количество"
            aria-label="Количество для передачи"
            style={inp}
          />
          <textarea
            value={transferNote}
            onChange={(e) => setTransferNote(e.target.value)}
            rows={3}
            maxLength={140}
            placeholder="Сообщение (до 140 символов)"
            aria-label="Сообщение к передаче"
            style={inp}
          />
          <div className="small">{String(transferNote || "").length}/140</div>
          <button className="btn" onClick={sendTransfer} disabled={!transferItem || !transferTo}>
            <Send className="icon" aria-hidden="true" />Отправить
          </button>
        </div>
      </Modal>

      <Modal open={splitOpen} title="Разделить стак" onClose={() => { setSplitOpen(false); setSplitItem(null); setSplitTarget(null); }}>
        <div className="list">
          {splitItem ? (
            <div className="small note-hint">
              <b>{splitItem.name}</b> • доступно: {splitAvailable}
            </div>
          ) : null}
          {splitTarget ? (
            <div className="small note-hint">
              Целевой слот: {splitTarget.container}:{splitTarget.slotX}:{splitTarget.slotY}
            </div>
          ) : null}
          <input
            type="number"
            min={1}
            max={getSplitInputMax(splitItem)}
            value={splitQty}
            onChange={(e) => setSplitQty(e.target.value)}
            placeholder="Сколько вынести в новый стак"
            aria-label="Количество для разделения стака"
            style={inp}
          />
          <button className="btn" onClick={confirmSplit} disabled={!splitItem}>
            Разделить
          </button>
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

function applyLayoutMoves(list, moves) {
  const items = Array.isArray(list) ? [...list] : [];
  const map = new Map((Array.isArray(moves) ? moves : [])
    .filter((move) => Number(move?.id) > 0)
    .map((move) => [Number(move.id), move]));
  if (!map.size) return items;
  return items.map((item) => {
    const patch = map.get(Number(item?.id));
    if (!patch) return item;
    return {
      ...item,
      container: patch.container,
      inv_container: patch.container,
      slotX: Number(patch.slotX),
      slotY: Number(patch.slotY),
      slot_x: Number(patch.slotX),
      slot_y: Number(patch.slotY)
    };
  });
}

function filterIconSections(sections, query) {
  const list = Array.isArray(sections) ? sections : [];
  const q = String(query || "").toLowerCase().trim();
  if (!q) return list;
  return list
    .map((section) => {
      const items = (section.items || []).filter((icon) => {
        const hay = `${icon.label || ""} ${icon.key || ""}`.toLowerCase();
        return hay.includes(q);
      });
      return items.length ? { ...section, items } : null;
    })
    .filter(Boolean);
}



