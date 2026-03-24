import React from "react";
import { RARITY_OPTIONS } from "../../../lib/inventoryRarity.js";

const inp = { width: "100%" };

export default function InventoryItemFormFields({
  form,
  setForm,
}) {
  return (
    <>
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
      <input
        value={(form.tags || []).join(", ")}
        onChange={(e) => setForm({ ...form, tags: e.target.value.split(",").map((s) => s.trim()).filter(Boolean) })}
        placeholder="Теги (через запятую)"
        aria-label="Теги предмета через запятую"
        style={inp}
      />
    </>
  );
}
