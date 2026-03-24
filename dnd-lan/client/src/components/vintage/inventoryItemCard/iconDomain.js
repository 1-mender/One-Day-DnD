import {
  Axe,
  Backpack,
  BowArrow,
  BookOpen,
  Crown,
  FlaskConical,
  Gem,
  Key,
  PocketKnife,
  ScrollText,
  Shield,
  Skull,
  Sword,
  Wand
} from "lucide-react";
import { getIconKeyFromItem, getInventoryIcon, stripIconTags } from "../../../lib/inventoryIcons.js";

const TAG_ICON_RULES = [
  { icon: Sword, match: ["weapon", "sword", "blade", "меч", "клин", "оруж"] },
  { icon: BowArrow, match: ["bow", "лук", "arrows", "ranged"] },
  { icon: Axe, match: ["axe", "топор"] },
  { icon: PocketKnife, match: ["dagger", "knife", "кинжал", "нож"] },
  { icon: Shield, match: ["shield", "armor", "armour", "брон", "щит", "доспех"] },
  { icon: Wand, match: ["wand", "staff", "посох", "жезл"] },
  { icon: ScrollText, match: ["scroll", "свиток"] },
  { icon: BookOpen, match: ["book", "tome", "grimoire", "книга", "том"] },
  { icon: FlaskConical, match: ["potion", "elixir", "flask", "зель", "эликс"] },
  { icon: Gem, match: ["gem", "jewel", "ring", "amulet", "камень", "самоцвет", "амулет", "кольц"] },
  { icon: Crown, match: ["crown", "legendary", "релик", "артефакт"] },
  { icon: Key, match: ["key", "ключ"] },
  { icon: Skull, match: ["necromancy", "skull", "curse", "проклят", "череп"] },
  { icon: Backpack, match: ["bag", "backpack", "рюк", "сумк", "pack"] }
];

function pickFallbackText(tokens) {
  const tags = tokens.map((token) => String(token).toLowerCase());
  if (tags.some((tag) => tag.includes("weapon") || tag.includes("меч") || tag.includes("лук"))) return "МЕЧ";
  if (tags.some((tag) => tag.includes("armor") || tag.includes("брон") || tag.includes("shield") || tag.includes("щит"))) return "БРОНЯ";
  if (tags.some((tag) => tag.includes("potion") || tag.includes("зель") || tag.includes("elixir"))) return "ЗЕЛЬЕ";
  if (tags.some((tag) => tag.includes("scroll") || tag.includes("свит"))) return "СВИТОК";
  if (tags.some((tag) => tag.includes("book") || tag.includes("книга"))) return "КНИГА";
  if (tags.some((tag) => tag.includes("ring") || tag.includes("amulet") || tag.includes("камень"))) return "АРТЕФ";
  return "ПРЕДМ";
}

export function pickInventoryIcon(item) {
  const iconKey = getIconKeyFromItem(item);
  const CustomIcon = getInventoryIcon(iconKey);
  if (CustomIcon) return { Icon: CustomIcon };
  const tokens = [
    item.name,
    item.type,
    item.category,
    ...stripIconTags(Array.isArray(item.tags) ? item.tags : [])
  ].filter(Boolean).map((token) => String(token).toLowerCase());
  const haystack = tokens.join(" ");
  const rule = TAG_ICON_RULES.find((candidate) => candidate.match.some((needle) => haystack.includes(needle)));
  if (rule?.icon) return { Icon: rule.icon };
  return { text: pickFallbackText(tokens) };
}
