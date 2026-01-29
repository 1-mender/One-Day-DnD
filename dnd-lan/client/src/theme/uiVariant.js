export const UI_VARIANTS = ["v1", "v2", "v3"];
const DEFAULT_UI = "v3";

export function applyUiVariant() {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  const url = new URL(window.location.href);
  const qp = url.searchParams.get("ui");
  const saved = localStorage.getItem("uiVariant");
  const v = UI_VARIANTS.includes(qp) ? qp : UI_VARIANTS.includes(saved) ? saved : DEFAULT_UI;
  document.documentElement.dataset.ui = v;
}

export function setUiVariant(v) {
  if (typeof document === "undefined") return;
  if (!UI_VARIANTS.includes(v)) return;
  localStorage.setItem("uiVariant", v);
  document.documentElement.dataset.ui = v;
}

export function cycleUiVariant() {
  if (typeof document === "undefined") return;
  const cur = document.documentElement.dataset.ui || DEFAULT_UI;
  const idx = UI_VARIANTS.indexOf(cur);
  const next = UI_VARIANTS[(idx + 1) % UI_VARIANTS.length];
  setUiVariant(next);
}
