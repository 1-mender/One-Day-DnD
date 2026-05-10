export const EMPTY_BESTIARY_FORM = {
  name: "",
  type: "",
  habitat: "",
  cr: "",
  description: "",
  abilities: [],
  stats: {},
  is_hidden: false
};

export function filterBestiary(items, query, visibility) {
  const q = String(query || "").toLowerCase().trim();
  return (items || []).filter((monster) => {
    if (visibility === "hidden" && !monster.is_hidden) return false;
    if (visibility === "public" && monster.is_hidden) return false;
    if (!q) return true;
    const haystack = [
      monster.name,
      monster.type,
      monster.habitat,
      monster.cr,
      monster.description,
      Array.isArray(monster.abilities) ? monster.abilities.join(" ") : ""
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(q);
  });
}
