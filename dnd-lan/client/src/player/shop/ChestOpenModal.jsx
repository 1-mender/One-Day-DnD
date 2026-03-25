import React from "react";
import Modal from "../../components/Modal.jsx";
import { getInventoryIcon } from "../../lib/inventoryIcons.js";

const REEL_KEYS = [
  "gi_locked_chest",
  "gi_key",
  "gi_gems",
  "gi_scroll_unfurled",
  "gi_rune_stone",
  "gi_ring",
  "gi_treasure_map",
  "gi_crown",
  "gi_chest"
];

const SPIN_STEPS = [70, 80, 90, 100, 110, 130, 150, 180, 220, 260];

export default function ChestOpenModal({ reward, open, onClose }) {
  const rewardIconKey = String(reward?.iconKey || "gi_chest");
  const RewardIcon = getInventoryIcon(rewardIconKey);
  const reel = React.useMemo(() => buildReel(rewardIconKey), [rewardIconKey]);
  const targetIndex = reel.length - 2;
  const [activeIndex, setActiveIndex] = React.useState(0);
  const [revealed, setRevealed] = React.useState(false);

  React.useEffect(() => {
    if (!open) return undefined;
    setActiveIndex(0);
    setRevealed(false);
    let timeoutId = null;
    let step = 0;

    const tick = () => {
      if (step >= SPIN_STEPS.length) {
        setActiveIndex(targetIndex);
        setRevealed(true);
        return;
      }
      setActiveIndex((current) => Math.min(current + 1, targetIndex));
      timeoutId = setTimeout(tick, SPIN_STEPS[step]);
      step += 1;
    };

    timeoutId = setTimeout(tick, 120);
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [open, targetIndex]);

  const visible = getVisibleReelItems(reel, activeIndex);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Сундук-сюрприз"
      className="tf-chest-modal"
      bodyClassName="tf-chest-modal-body"
    >
      <div className="tf-chest-shell">
        <div className="tf-chest-overline">Dungeon surprise</div>
        <div className="tf-chest-title">Сундук открыт</div>
        <div className="small tf-chest-hint">
          {revealed ? "Награда уже добавлена в инвентарь." : "Лента прокручивается, ищем редкую добычу..."}
        </div>

        <div className={`tf-chest-reel${revealed ? " is-revealed" : " is-spinning"}`}>
          {visible.map((entry, index) => {
            const Icon = getInventoryIcon(entry.iconKey);
            const isCenter = index === 1;
            return (
              <div
                key={`${entry.iconKey}-${entry.id}`}
                className={`tf-chest-reel-card${isCenter ? " is-center" : ""}${entry.iconKey === rewardIconKey && revealed && isCenter ? " is-winning" : ""}`}
              >
                {Icon ? <Icon /> : <span>{fallbackGlyph(entry.iconKey)}</span>}
              </div>
            );
          })}
        </div>

        <div className={`tf-chest-reward-card${revealed ? " is-visible" : ""}`}>
          <div className="tf-chest-reward-head">
            <div className="tf-chest-reward-icon">
              {RewardIcon ? <RewardIcon /> : <span>{fallbackGlyph(rewardIconKey)}</span>}
            </div>
            <div className="tf-chest-reward-copy">
              <div className="tf-chest-reward-name">{reward?.name || "Неизвестная находка"}</div>
              <span className={`badge tf-chest-rarity tf-rarity-${String(reward?.rarity || "common")}`}>
                {formatRarity(reward?.rarity)}
              </span>
            </div>
          </div>
          <div className="small tf-chest-reward-desc">
            {reward?.description || "Награда добавлена в инвентарь."}
          </div>
        </div>
      </div>
    </Modal>
  );
}

function buildReel(rewardIconKey) {
  const prefix = [
    "gi_locked_chest",
    "gi_key",
    "gi_gems",
    "gi_scroll_unfurled",
    "gi_rune_stone",
    "gi_ring"
  ];
  return [...prefix, ...REEL_KEYS, rewardIconKey, rewardIconKey].map((iconKey, index) => ({
    id: index,
    iconKey
  }));
}

function getVisibleReelItems(reel, activeIndex) {
  const center = Math.max(1, Math.min(activeIndex, reel.length - 2));
  return [reel[center - 1], reel[center], reel[center + 1]];
}

function formatRarity(value) {
  const key = String(value || "common");
  if (key === "uncommon") return "Необычное";
  if (key === "rare") return "Редкое";
  if (key === "very_rare") return "Очень редкое";
  if (key === "legendary") return "Легендарное";
  return "Обычное";
}

function fallbackGlyph(iconKey) {
  return String(iconKey || "?").slice(3, 4).toUpperCase() || "?";
}
