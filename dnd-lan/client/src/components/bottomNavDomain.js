export function partitionNavItems(items = []) {
  const normalized = (items || []).filter((it) => it && typeof it.to === "string" && typeof it.label === "string");
  const hasExplicitPrimary = normalized.some((it) => it.primary === true);
  const primary = hasExplicitPrimary
    ? normalized.filter((it) => it.primary === true).slice(0, 4)
    : normalized.slice(0, 4);
  const secondary = normalized.filter((it) => !primary.includes(it));
  return { normalized, primary, secondary };
}
