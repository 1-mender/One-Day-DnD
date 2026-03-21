import React from "react";
import Modal from "../../../components/Modal.jsx";
import { INVENTORY_ICON_SECTIONS } from "../../../lib/inventoryIcons.js";
import { RARITY_OPTIONS } from "../../../lib/inventoryRarity.js";

const inp = { width: "100%" };

export default function InventoryItemModal({
  open,
  edit,
  closeEditor,
  form,
  setForm,
  selectedIcon: SelectedIcon,
  iconPickerOpen,
  setIconPickerOpen,
  iconQuery,
  setIconQuery,
  filteredIconSections,
  save
}) {
  return (
    <Modal open={open} title={edit ? "Редактировать предмет" : "Новый предмет"} onClose={closeEditor}>
      <div className="list">
        <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Название*" aria-label="Название предмета" style={inp} />
        <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Описание" aria-label="Описание предмета" rows={4} style={inp} />
        <div className="row">
          <input value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} placeholder="Количество" aria-label="Количество предмета" style={inp} />
          <input value={form.weight} onChange={(e) => setForm({ ...form, weight: e.target.value })} placeholder="Вес" aria-label="Вес предмета" style={inp} />
        </div>
        <div className="row">
          <select value={form.rarity} onChange={(e) => setForm({ ...form, rarity: e.target.value })} aria-label="Редкость" style={inp}>
            {RARITY_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select value={form.visibility} onChange={(e) => setForm({ ...form, visibility: e.target.value })} aria-label="Видимость" style={inp}>
            <option value="public">Публичные</option>
            <option value="hidden">Скрытые</option>
          </select>
        </div>
        <div className="row" style={{ alignItems: "center" }}>
          <select
            value={form.iconKey || ""}
            onChange={(e) => setForm({ ...form, iconKey: e.target.value })}
            aria-label="Иконка предмета"
            style={inp}
          >
            <option value="">Иконка: нет</option>
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
              <span className="small">Без иконки</span>
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
          onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
          placeholder="Теги (через запятую)"
          aria-label="Теги предмета через запятую"
          style={inp}
        />
        <button className="btn" onClick={save}>Сохранить</button>
      </div>
    </Modal>
  );
}
