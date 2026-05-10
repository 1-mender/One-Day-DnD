export function toPlainText(value) {
  return String(value || "")
    .replace(/\[(.*?)\]\(.*?\)/g, "$1")
    .replace(/[`*_>#~]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function truncateText(value, max = 160) {
  if (!value) return "";
  if (value.length <= max) return value;
  const end = Math.max(0, max - 3);
  return `${value.slice(0, end).trim()}...`;
}
