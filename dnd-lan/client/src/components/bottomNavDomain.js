const DEFAULT_MAX_PRIMARY = 5;

export function partitionNavItems(items = [], maxPrimary = DEFAULT_MAX_PRIMARY) {
  const normalized = (items || []).filter((it) => it && typeof it.to === "string" && typeof it.label === "string");
  const cap = Number.isFinite(maxPrimary) ? Math.max(1, Math.floor(maxPrimary)) : DEFAULT_MAX_PRIMARY;
  const hasExplicitPrimary = normalized.some((it) => it.primary === true);
  const preferred = hasExplicitPrimary
    ? normalized.filter((it) => it.primary === true)
    : normalized;
  const fallback = normalized.filter((it) => !preferred.includes(it));
  const primary = [...preferred, ...fallback].slice(0, cap);
  const secondary = normalized.filter((it) => !primary.includes(it));
  return { normalized, primary, secondary };
}
