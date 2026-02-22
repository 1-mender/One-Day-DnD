import React from "react";
import { useTickets } from "../hooks/useTickets.js";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { formatError } from "../lib/formatError.js";

const catalog = [
  {
    key: "boosts",
    title: "Core Upgrades",
    subtitle: "Rare, high-impact effects with strict limits",
    items: [
      {
        key: "stat",
        title: "+1 Stat",
        blurb: "Pick STR/DEX/CON/INT/WIS/CHA. The upgrade is stored in profile.",
        price: 12,
        impact: "Power",
        limit: "1 per character",
        note: "Requires DM approval"
      },
      {
        key: "feat",
        title: "Talent Memo",
        blurb: "A thematic perk with moderate impact, finalized by DM.",
        price: 15,
        impact: "Power",
        limit: "1 per session",
        note: "Story value over raw numbers"
      }
    ]
  },
  {
    key: "consumables",
    title: "Consumables",
    subtitle: "Tactical tools for critical moments",
    items: [
      {
        key: "reroll",
        title: "Single Reroll",
        blurb: "Replace one roll result with a new throw.",
        price: 4,
        impact: "Tactic",
        limit: "2 per session",
        note: "Can be used after the roll"
      },
      {
        key: "luck",
        title: "Luck Seal",
        blurb: "+1 to one roll in an episode, active until scene end.",
        price: 3,
        impact: "Tactic",
        limit: "3 per session",
        note: "Stacks with inspiration"
      }
    ]
  },
  {
    key: "mystery",
    title: "Mystery Shelf",
    subtitle: "Risky options for unexpected plot twists",
    items: [
      {
        key: "chest",
        title: "Surprise Chest",
        blurb: "Random reward from DM pool: artifact, key, or hidden clue.",
        price: 7,
        impact: "Risk",
        limit: "1 per session",
        note: "Outcome depends on luck"
      },
      {
        key: "hint",
        title: "Secret Hint",
        blurb: "One contextual clue for a scene or an NPC.",
        price: 5,
        impact: "Risk",
        limit: "2 per session",
        note: "Deepens lore paths"
      }
    ]
  }
];

function priceLabel(price) {
  if (!Number.isFinite(price)) return "-";
  const qty = Number(price);
  return `${qty} ticket${qty === 1 ? "" : "s"}`;
}

export default function ShopJoe() {
  const toast = useToast();
  const { state, rules, usage, loading, err, purchase, readOnly } = useTickets();
  const balance = Number(state?.balance || 0);
  const ticketsEnabled = rules?.enabled !== false;

  async function handleBuy(itemKey) {
    if (!ticketsEnabled) {
      toast.error("Shop is closed by DM.");
      return;
    }
    try {
      const res = await purchase({ itemKey });
      const price = res?.result?.price ?? rules?.shop?.[itemKey]?.price ?? 0;
      toast.success(`-${price} tickets`, "Purchase complete");
    } catch (e) {
      const msg = formatTicketError(formatError(e));
      toast.error(msg);
    }
  }

  return (
    <div className="card taped shop-shell">
      <div className="row" style={{ justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div className="shop-title">DJO - Ticket Shop</div>
          <div className="small">Tickets have weight: the strongest effects are limited.</div>
        </div>
        <div className="ticket-bank">
          <div className="ticket-card">
            <div className="ticket-label">Balance</div>
            <div className="ticket-value">{loading ? "..." : balance}</div>
          </div>
          <div className="ticket-meta small">Top items are best used after a win streak.</div>
        </div>
      </div>

      <ShopMascotStall balance={balance} ticketsEnabled={ticketsEnabled} />

      <div className="shop-banner">
        <div className="banner-title">Tickets are choices</div>
        <div className="small">
          Legendary effects are rare, consumables are your scene stabilizers.
        </div>
      </div>
      {!ticketsEnabled ? (
        <div className="badge off" style={{ marginTop: 8 }}>Shop is closed by DM</div>
      ) : null}
      {err ? <div className="badge off" style={{ marginTop: 8 }}>Ticket error: {err}</div> : null}
      <hr />

      <div className="list">
        {catalog.map((section) => (
          <div key={section.key} className="paper-note">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="title">{section.title}</div>
              <div className="small">{section.subtitle}</div>
            </div>
            <div className="shop-grid" style={{ marginTop: 10 }}>
              {section.items.map((item) => (
                <div
                  key={item.key}
                  className={`item taped shop-card${rules?.shop?.[item.key]?.enabled === false ? " disabled-card" : ""}`}
                >
                  <div className="shop-head">
                    <div className="shop-item-title">{item.title}</div>
                    <span className={`badge ${rules?.shop?.[item.key]?.enabled === false ? "off" : `badge-impact ${impactClass(item.impact)}`}`}>
                      {rules?.shop?.[item.key]?.enabled === false ? "Closed" : item.impact}
                    </span>
                  </div>
                  <div className="small">{item.blurb}</div>
                  <div className="shop-meta">
                    <span className="meta-chip">
                      Limit: {formatLimit(item.key, item.limit, rules?.shop?.[item.key]?.dailyLimit)}
                    </span>
                    <span className="meta-chip">{item.note}</span>
                    {rules?.shop?.[item.key]?.dailyLimit ? (
                      <span className="meta-chip">
                        Today: {usage?.purchasesToday?.[item.key] || 0}/{rules.shop[item.key].dailyLimit}
                      </span>
                    ) : null}
                  </div>
                  <div className="row shop-actions" style={{ justifyContent: "space-between" }}>
                    <span className="ticket-pill">{priceLabel(resolvePrice(item.key, item.price, rules))}</span>
                    <button
                      className="btn secondary"
                      disabled={
                        readOnly ||
                        err ||
                        !rules ||
                        !ticketsEnabled ||
                        rules?.shop?.[item.key]?.enabled === false ||
                        balance < resolvePrice(item.key, item.price, rules) ||
                        isLimitReached(item.key, rules, usage)
                      }
                      onClick={() => handleBuy(item.key)}
                    >
                      Buy
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ShopMascotStall({ balance, ticketsEnabled }) {
  const line = getMascotLine(balance, ticketsEnabled);
  return (
    <div className="shop-mascot-stall">
      <svg
        className="shop-mascot-svg"
        viewBox="0 0 640 240"
        role="img"
        aria-label="Mascot behind the counter"
      >
        <defs>
          <linearGradient id="shopCurtain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#55304f" />
            <stop offset="100%" stopColor="#2e1c2f" />
          </linearGradient>
          <linearGradient id="shopCounter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#c89354" />
            <stop offset="100%" stopColor="#81512c" />
          </linearGradient>
          <linearGradient id="shopPig" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f5c184" />
            <stop offset="100%" stopColor="#da9c63" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="640" height="148" fill="url(#shopCurtain)" />
        <rect x="26" y="26" width="148" height="106" rx="10" fill="#3e2a3f" opacity="0.9" />
        <rect x="466" y="24" width="146" height="108" rx="10" fill="#3e2a3f" opacity="0.9" />
        <rect x="492" y="38" width="44" height="32" rx="7" fill="#7a5a37" />
        <rect x="546" y="38" width="44" height="32" rx="7" fill="#7a5a37" />
        <rect x="492" y="80" width="98" height="34" rx="7" fill="#7a5a37" />

        <g className="shop-mascot-body">
          <ellipse cx="320" cy="118" rx="72" ry="52" fill="url(#shopPig)" />
          <circle cx="320" cy="96" r="45" fill="url(#shopPig)" />
          <ellipse cx="286" cy="58" rx="18" ry="26" fill="url(#shopPig)" transform="rotate(-24 286 58)" />
          <ellipse cx="354" cy="58" rx="18" ry="26" fill="url(#shopPig)" transform="rotate(24 354 58)" />
          <ellipse cx="302" cy="98" rx="10" ry="9" fill="#3f2b1f" />
          <ellipse cx="338" cy="98" rx="10" ry="9" fill="#3f2b1f" />
          <ellipse className="shop-mascot-eye" cx="302" cy="98" rx="4" ry="4" fill="#101010" />
          <ellipse className="shop-mascot-eye" cx="338" cy="98" rx="4" ry="4" fill="#101010" />
          <ellipse cx="320" cy="116" rx="21" ry="15" fill="#efb37b" />
          <circle cx="312" cy="116" r="2.9" fill="#6b3a27" />
          <circle cx="328" cy="116" r="2.9" fill="#6b3a27" />
          <path d="M304 131 Q320 140 336 131" fill="none" stroke="#744734" strokeWidth="3" strokeLinecap="round" />
        </g>

        <rect x="0" y="146" width="640" height="24" fill="#3a261a" opacity="0.75" />
        <rect x="0" y="170" width="640" height="70" fill="url(#shopCounter)" />
        <g className="shop-mascot-paw">
          <ellipse cx="268" cy="174" rx="38" ry="14" fill="#f3be82" />
          <ellipse cx="376" cy="174" rx="38" ry="14" fill="#f3be82" />
          <rect x="252" y="168" width="32" height="18" rx="8" fill="#f3be82" />
          <rect x="360" y="168" width="32" height="18" rx="8" fill="#f3be82" />
        </g>

        <rect x="28" y="178" width="88" height="48" rx="8" fill="#1f4027" />
        <text x="72" y="206" textAnchor="middle" fill="#d4f2a0" fontSize="16" fontWeight="700">
          x1
        </text>
        <circle cx="132" cy="202" r="12" fill="#e7cc6f" />
      </svg>
      <div className="shop-mascot-bubble" aria-live="polite">
        <span className="shop-mascot-name">JOE THE BROKER</span>
        <span>{line}</span>
      </div>
    </div>
  );
}

function getMascotLine(balance, ticketsEnabled) {
  if (!ticketsEnabled) return "Counter is closed by DM. Come back later.";
  if (balance <= 2) return "Start small: Luck Seal and rerolls are your best bets.";
  if (balance >= 12) return "You can afford a major upgrade today.";
  return "Pick your tools carefully, the next scene can flip fast.";
}

function impactClass(label) {
  const v = String(label || "").toLowerCase();
  if (v.includes("power")) return "impact-high";
  if (v.includes("risk")) return "impact-high";
  if (v.includes("tactic")) return "impact-mid";
  return "impact-low";
}

function resolvePrice(itemKey, fallback, rules) {
  const price = rules?.shop?.[itemKey]?.price;
  return Number.isFinite(price) ? price : Number(fallback || 0);
}

function formatLimit(itemKey, fallback, dailyLimit) {
  if (dailyLimit) return `up to ${dailyLimit} per day`;
  return fallback || "-";
}

function isLimitReached(itemKey, rules, usage) {
  const lim = rules?.shop?.[itemKey]?.dailyLimit;
  if (!lim) return false;
  const used = usage?.purchasesToday?.[itemKey] || 0;
  return used >= lim;
}

function formatTicketError(code) {
  const c = String(code || "");
  if (c === "tickets_disabled") return "Shop is temporarily closed.";
  if (c === "item_disabled") return "This item is currently unavailable.";
  if (c === "not_enough_tickets") return "Not enough tickets for this purchase.";
  if (c === "daily_item_limit") return "Daily purchase limit reached for this item.";
  if (c === "daily_spend_cap") return "Daily spending cap reached.";
  if (c === "invalid_item") return "Item is unavailable.";
  return c || "Error";
}
