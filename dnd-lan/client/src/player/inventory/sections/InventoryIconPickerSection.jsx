import React from "react";
import { INVENTORY_ICON_SECTIONS } from "../../../lib/inventoryIcons.js";

const inp = { width: "100%" };

export default function InventoryIconPickerSection({
  form,
  setForm,
  selectedIcon: SelectedIcon,
  iconPickerOpen,
  setIconPickerOpen,
  iconQuery,
  setIconQuery,
  filteredIconSections,
}) {
  return (
    <>
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
    </>
  );
}
