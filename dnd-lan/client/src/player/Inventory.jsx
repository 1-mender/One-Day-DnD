import React from "react";
import { useNavigate } from "react-router-dom";
import Modal from "../components/Modal.jsx";
import InventoryItemCard, { pickInventoryIcon } from "../components/vintage/InventoryItemCard.jsx";
import InventorySlotGrid from "./InventorySlotGrid.jsx";
import { Eye, EyeOff, Grid3x3, LayoutGrid, List, Package, Plus, RefreshCcw, Scale, Send } from "lucide-react";
import ErrorBanner from "../components/ui/ErrorBanner.jsx";
import EmptyState from "../components/ui/EmptyState.jsx";
import Skeleton from "../components/ui/Skeleton.jsx";
import {
  INVENTORY_ICON_SECTIONS,
  getInventoryIcon
} from "../lib/inventoryIcons.js";
import { RARITY_OPTIONS } from "../lib/inventoryRarity.js";
import {
  getSplitInputMax
} from "./inventoryDomain.js";
import { useInventoryController } from "./inventory/useInventoryController.js";

export default function Inventory() {
  const nav = useNavigate();
  const {
    q,
    setQ,
    vis,
    setVis,
    rarity,
    setRarity,
    view,
    setView,
    items,
    players,
    maxWeight,
    open,
    setOpen,
    edit,
    form,
    setForm,
    transferOpen,
    setTransferOpen,
    transferItem,
    transferTo,
    setTransferTo,
    transferQty,
    setTransferQty,
    transferNote,
    setTransferNote,
    splitOpen,
    splitItem,
    splitQty,
    setSplitQty,
    splitTarget,
    err,
    loading,
    lite,
    isNarrowScreen,
    listRef,
    iconQuery,
    setIconQuery,
    iconPickerOpen,
    setIconPickerOpen,
    layoutSaving,
    mobileStatsOpen,
    setMobileStatsOpen,
    mobileFavoritesOpen,
    setMobileFavoritesOpen,
    readOnly,
    actionsVariant,
    load,
    filtered,
    totalWeight,
    publicCount,
    hiddenCount,
    totalWeightAll,
    favorites,
    filteredIconSections,
    hasAny,
    SelectedIcon,
    startAdd,
    startEdit,
    startTransfer,
    startSplit,
    save,
    del,
    sendTransfer,
    toggleVisibility,
    toggleFavorite,
    moveLayoutItems,
    quickEquip,
    confirmSplit,
    hasWeightLimit,
    weightStatus,
    transferAvailable,
    transferInputMax,
    splitAvailable,
    closeSplit
  } = useInventoryController();

  return (
    <div className={`card inventory-shell${lite ? " page-lite" : ""}`.trim()}>
      <div className="inv-header">
        <div className="inv-header-main">
          <div className="inv-title-lg">Инвентарь</div>
          <div className="inv-subtitle">
            Вес (по фильтру): {totalWeight.toFixed(2)}
            {readOnly ? <span className="badge warn">только чтение</span> : null}
          </div>
        </div>
        {!isNarrowScreen ? (
          <div className="inv-header-actions">
            <button className="btn secondary" onClick={() => nav("/app/transfers")}>Передачи</button>
            <button className="btn" onClick={startAdd} disabled={readOnly}><Plus className="icon" aria-hidden="true" />Добавить</button>
            <button className="btn secondary" onClick={load}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
          </div>
        ) : null}
      </div>

      {isNarrowScreen ? (
        <div className="inv-mobile-sticky">
          <div className="inv-mobile-search">
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Поиск по названию..."
              aria-label="Поиск предметов по названию"
            />
          </div>
          <div className="inv-mobile-quick-actions">
            <button className="btn secondary" onClick={() => nav("/app/transfers")}>Передачи</button>
            <button className="btn" onClick={startAdd} disabled={readOnly}><Plus className="icon" aria-hidden="true" />Добавить</button>
            <button className="btn secondary" onClick={load}><RefreshCcw className="icon" aria-hidden="true" />Обновить</button>
          </div>
        </div>
      ) : null}

      {isNarrowScreen ? (
        <details
          className="inv-panel inv-mobile-section"
          open={mobileStatsOpen}
          onToggle={(event) => setMobileStatsOpen(event.currentTarget.open)}
        >
          <summary className="inv-mobile-section-summary">Показатели</summary>
          <div className="inv-mobile-section-body">
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
          </div>
        </details>
      ) : (
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
      )}

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
          {!isNarrowScreen ? (
            <input
              value={q}
              onChange={(e)=>setQ(e.target.value)}
              placeholder="Поиск по названию..."
              aria-label="Поиск предметов по названию"
            />
          ) : null}
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

      {isNarrowScreen ? (
        <details
          className="inv-panel inv-mobile-section inv-favorites"
          open={mobileFavoritesOpen}
          onToggle={(event) => setMobileFavoritesOpen(event.currentTarget.open)}
        >
          <summary className="inv-mobile-section-summary">Избранное</summary>
          <div className="inv-mobile-section-body">
            <div className="small">Быстрые слоты предметов</div>
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
        </details>
      ) : (
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
      )}

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
              touchOptimized={isNarrowScreen}
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

      <Modal open={splitOpen} title="Разделить стак" onClose={closeSplit}>
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
