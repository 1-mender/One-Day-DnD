export const UI_VARIANTS = ["v1", "v2", "v3"];
const DEFAULT_UI = "v3";

function emitUiVariantChanged(variant) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent("ui-variant:changed", { detail: variant }));
}

function safeGetUiVariant() {
  try {
    return localStorage.getItem("uiVariant");
  } catch {
    return "";
  }
}

function safeSetUiVariant(v) {
  try {
    localStorage.setItem("uiVariant", v);
  } catch {
    // Storage may be unavailable in some mobile browser modes.
  }
}

export function applyUiVariant() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  let qp = "";
  try {
    qp = new URL(window.location.href).searchParams.get("ui") || "";
  } catch {
    qp = "";
  }
  const saved = safeGetUiVariant();
  const v = UI_VARIANTS.includes(qp) ? qp : UI_VARIANTS.includes(saved) ? saved : DEFAULT_UI;
  document.documentElement.dataset.ui = v;
  emitUiVariantChanged(v);
}

export function setUiVariant(v) {
  if (typeof document === "undefined") return;
  if (!UI_VARIANTS.includes(v)) return;
  safeSetUiVariant(v);
  document.documentElement.dataset.ui = v;
  emitUiVariantChanged(v);
}

export function getUiVariant() {
  if (typeof document === "undefined") return DEFAULT_UI;
  const current = document.documentElement.dataset.ui || "";
  return UI_VARIANTS.includes(current) ? current : DEFAULT_UI;
}

export function cycleUiVariant() {
  if (typeof document === "undefined") return;
  const cur = getUiVariant();
  const idx = UI_VARIANTS.indexOf(cur);
  const next = UI_VARIANTS[(idx + 1) % UI_VARIANTS.length];
  setUiVariant(next);
}
