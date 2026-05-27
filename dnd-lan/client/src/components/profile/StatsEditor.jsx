import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_KEYS = ["str", "dex", "con", "int", "wis", "cha", "vit"];
const DEFAULT_MAX_STATS = 24;
const KEY_MAX = 24;
const VALUE_MAX = 280;
const genRowId = () => `row_${Math.random().toString(36).slice(2, 10)}`;

function normalizeStats(stats) {
  if (stats && typeof stats === "object" && !Array.isArray(stats)) return stats;
  return {};
}

function normalizeDefaultKeys(keys) {
  if (!Array.isArray(keys) || !keys.length) return [];
  return keys
    .map((key) => String(key || "").trim())
    .filter(Boolean)
    .filter((key, index, list) => list.indexOf(key) === index);
}

function buildRows(stats, defaultKeys) {
  const s = normalizeStats(stats);
  const rows = [];
  const used = new Set();
  for (const key of defaultKeys) {
    rows.push({ id: `fixed_${key}`, key, value: s[key] ?? "", fixed: true });
    used.add(key);
  }
  for (const key of Object.keys(s)) {
    if (used.has(key)) continue;
    rows.push({ id: `extra_${key}`, key, value: s[key] ?? "", fixed: false });
  }
  return rows;
}

function normalizeHiddenKeys(keys) {
  if (!Array.isArray(keys) || !keys.length) return [];
  return keys
    .map((key) => String(key || "").trim())
    .filter(Boolean)
    .filter((key, index, list) => list.indexOf(key) === index);
}

function rowsToStats(rows, hiddenStats = {}) {
  const out = { ...normalizeStats(hiddenStats) };
  for (const row of rows) {
    const key = String(row.key || "").trim();
    if (!key) continue;
    const raw = row.value;
    if (raw === "" || raw == null) continue;
    const num = Number(raw);
    out[key] = Number.isFinite(num) && String(raw).trim() !== "" ? num : raw;
  }
  return out;
}

function getKeyLabel(key, keyLabels) {
  return String(keyLabels?.[key] || key || "");
}

export function StatsView({ stats, keyLabels = null, hiddenKeys = [], emptyLabel = "Статы не заполнены" }) {
  const hidden = new Set(normalizeHiddenKeys(hiddenKeys));
  const items = Object.entries(normalizeStats(stats)).filter(([key]) => !hidden.has(key));
  if (!items.length) return <div className="small">{emptyLabel}</div>;
  return (
    <div className="stat-grid">
      {items.map(([key, value]) => (
        <div key={key} className="stat-chip">
          <span className="stat-key">{getKeyLabel(key, keyLabels) || key}</span>
          <span className="stat-val">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsEditor({
  value,
  onChange,
  readOnly = false,
  defaultKeys = DEFAULT_KEYS,
  keyLabels = null,
  addLabel = "+ Добавить стат",
  maxStats = DEFAULT_MAX_STATS,
  hiddenKeys = []
}) {
  const normalizedDefaultKeys = useMemo(() => normalizeDefaultKeys(defaultKeys), [defaultKeys]);
  const normalizedHiddenKeys = useMemo(() => normalizeHiddenKeys(hiddenKeys), [hiddenKeys]);
  const hiddenKeySet = useMemo(() => new Set(normalizedHiddenKeys), [normalizedHiddenKeys]);
  const hiddenStats = useMemo(() => {
    const source = normalizeStats(value);
    return Object.fromEntries(Object.entries(source).filter(([key]) => hiddenKeySet.has(key)));
  }, [hiddenKeySet, value]);
  const resolvedDefaultKeys = normalizedDefaultKeys.length ? normalizedDefaultKeys : DEFAULT_KEYS;
  const defaultKeysSignature = resolvedDefaultKeys.join("|");
  const [rows, setRows] = useState(() => buildRows(value, resolvedDefaultKeys).filter((row) => !hiddenKeySet.has(row.key)));
  const lastEmitted = useRef("");

  useEffect(() => {
    const incoming = JSON.stringify(normalizeStats(value));
    if (incoming === lastEmitted.current) return;
    setRows(buildRows(value, resolvedDefaultKeys).filter((row) => !hiddenKeySet.has(row.key)));
  }, [defaultKeysSignature, hiddenKeySet, resolvedDefaultKeys, value]);

  function updateRow(idx, patch) {
    if (readOnly) return;
    const next = rows.map((row, index) => (index === idx ? { ...row, ...patch } : row));
    setRows(next);
    const nextStats = rowsToStats(next, hiddenStats);
    lastEmitted.current = JSON.stringify(nextStats);
    onChange?.(nextStats);
  }

  function addRow() {
    if (readOnly) return;
    if (rows.length >= maxStats) return;
    setRows((current) => [...current, { id: genRowId(), key: "", value: "", fixed: false }]);
  }

  function removeRow(idx) {
    if (readOnly) return;
    const next = rows.filter((_, index) => index !== idx);
    setRows(next);
    const nextStats = rowsToStats(next, hiddenStats);
    lastEmitted.current = JSON.stringify(nextStats);
    onChange?.(nextStats);
  }

  return (
    <div className="list">
      {rows.map((row, idx) => (
        <div key={row.id} className="row" style={{ alignItems: "center" }}>
          {row.fixed ? (
            <div className="badge" style={{ minWidth: 74, textAlign: "center" }}>
              {getKeyLabel(row.key, keyLabels) || row.key}
            </div>
          ) : (
            <input
              value={row.key}
              onChange={(event) => updateRow(idx, { key: event.target.value })}
              placeholder="ключ"
              aria-label={`Ключ стата ${idx + 1}`}
              maxLength={KEY_MAX}
              disabled={readOnly}
              style={{ width: 120 }}
            />
          )}
          <input
            value={row.value}
            onChange={(event) => updateRow(idx, { value: event.target.value })}
            placeholder="значение"
            aria-label={`Значение стата ${row.key || idx + 1}`}
            maxLength={VALUE_MAX}
            disabled={readOnly}
            style={{ flex: 1 }}
          />
          {!row.fixed ? (
            <button className="btn secondary" onClick={() => removeRow(idx)} disabled={readOnly}>Удалить</button>
          ) : null}
        </div>
      ))}
      <button className="btn secondary" onClick={addRow} disabled={readOnly || rows.length >= maxStats}>
        {addLabel}
      </button>
      <div className="small">Максимум полей: {maxStats}</div>
    </div>
  );
}
