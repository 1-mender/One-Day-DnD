export const RARITY_OPTIONS = [
  { value: "common", label: "Общего доступа (серый)" },
  { value: "uncommon", label: "Для служебного пользования (зеленый)" },
  { value: "rare", label: "Секретно (синий)" },
  { value: "very_rare", label: "Совершенно секретно (фиолетовый)" },
  { value: "legendary", label: "Особой важности (оранжевый/золотой)" },
  { value: "custom", label: "Другое (кастом)" }
];

export function getRarityLabel(value) {
  const v = String(value || "common");
  const found = RARITY_OPTIONS.find((opt) => opt.value === v);
  return found ? found.label : v;
}
