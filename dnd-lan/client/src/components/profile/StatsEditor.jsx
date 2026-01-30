import React, { useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_KEYS = ["str", "dex", "con", "int", "wis", "cha", "vit"];
const MAX_STATS = 20;
const KEY_MAX = 24;
const VALUE_MAX = 64;

function normalizeStats(stats) {
  if (stats && typeof stats === "object" && !Array.isArray(stats)) return stats;
  return {};
}

function buildRows(stats) {
  const s = normalizeStats(stats);
  const rows = [];
  const used = new Set();
  for (const key of DEFAULT_KEYS) {
    rows.push({ key, value: s[key] ?? "" , fixed: true });
    used.add(key);
  }
  for (const key of Object.keys(s)) {
    if (used.has(key)) continue;
    rows.push({ key, value: s[key] ?? "", fixed: false });
  }
  return rows;
}

function rowsToStats(rows) {
  const out = {};
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

export function StatsView({ stats }) {
  const items = useMemo(() => Object.entries(normalizeStats(stats)), [stats]);
  if (!items.length) return <div className="small">Статы не заполнены</div>;
  return (
    <div className="stat-grid">
      {items.map(([k, v]) => (
        <div key={k} className="stat-chip">
          <span className="stat-key">{k}</span>
          <span className="stat-val">{String(v)}</span>
        </div>
      ))}
    </div>
  );
}

export function StatsEditor({ value, onChange }) {
  const [rows, setRows] = useState(() => buildRows(value));
  const lastEmitted = useRef("");

  useEffect(() => {
    const incoming = JSON.stringify(normalizeStats(value));
    if (incoming === lastEmitted.current) return;
    setRows(buildRows(value));
  }, [value]);

  function updateRow(idx, patch) {
    const next = rows.map((r, i) => (i === idx ? { ...r, ...patch } : r));
    setRows(next);
    const nextStats = rowsToStats(next);
    lastEmitted.current = JSON.stringify(nextStats);
    onChange?.(nextStats);
  }

  function addRow() {
    if (rows.length >= MAX_STATS) return;
    const next = [...rows, { key: "", value: "", fixed: false }];
    setRows(next);
  }

  function removeRow(idx) {
    const next = rows.filter((_, i) => i !== idx);
    setRows(next);
    const nextStats = rowsToStats(next);
    lastEmitted.current = JSON.stringify(nextStats);
    onChange?.(nextStats);
  }

  return (
    <div className="list">
      {rows.map((row, idx) => (
        <div key={`${row.key}-${idx}`} className="row" style={{ alignItems: "center" }}>
          {row.fixed ? (
            <div className="badge" style={{ minWidth: 74, textTransform: "uppercase", textAlign: "center" }}>
              {row.key}
            </div>
          ) : (
            <input
              value={row.key}
              onChange={(e) => updateRow(idx, { key: e.target.value })}
              placeholder="ключ"
              maxLength={KEY_MAX}
              style={{ width: 120 }}
            />
          )}
          <input
            value={row.value}
            onChange={(e) => updateRow(idx, { value: e.target.value })}
            placeholder="значение"
            maxLength={VALUE_MAX}
            style={{ flex: 1 }}
          />
          {!row.fixed ? (
            <button className="btn secondary" onClick={() => removeRow(idx)}>Удалить</button>
          ) : null}
        </div>
      ))}
      <button className="btn secondary" onClick={addRow} disabled={rows.length >= MAX_STATS}>
        + Добавить стат
      </button>
      <div className="small">Максимум статов: {MAX_STATS}</div>
    </div>
  );
}
