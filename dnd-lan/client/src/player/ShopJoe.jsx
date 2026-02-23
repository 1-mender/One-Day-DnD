import React from "react";
import { useTickets } from "../hooks/useTickets.js";
import { useToast } from "../components/ui/ToastProvider.jsx";
import { formatError } from "../lib/formatError.js";

const catalog = [
  {
    key: "boosts",
    title: "\u042f\u0434\u0440\u043e \u0443\u0441\u0438\u043b\u0435\u043d\u0438\u0439",
    subtitle: "\u0420\u0435\u0434\u043a\u0438\u0435 \u044d\u0444\u0444\u0435\u043a\u0442\u044b \u0441 \u0431\u043e\u043b\u044c\u0448\u0438\u043c \u0432\u043b\u0438\u044f\u043d\u0438\u0435\u043c \u0438 \u0441\u0442\u0440\u043e\u0433\u0438\u043c\u0438 \u043b\u0438\u043c\u0438\u0442\u0430\u043c\u0438",
    items: [
      {
        key: "stat",
        title: "+1 \u043a \u0445\u0430\u0440\u0430\u043a\u0442\u0435\u0440\u0438\u0441\u0442\u0438\u043a\u0435",
        blurb: "\u0412\u044b\u0431\u0435\u0440\u0438 \u0421\u0418\u041b/\u041b\u041e\u0412/\u0422\u0415\u041b/\u0418\u041d\u0422/\u041c\u0414\u0420/\u0425\u0410\u0420. \u0423\u043b\u0443\u0447\u0448\u0435\u043d\u0438\u0435 \u0441\u043e\u0445\u0440\u0430\u043d\u044f\u0435\u0442\u0441\u044f \u0432 \u043f\u0440\u043e\u0444\u0438\u043b\u0435.",
        price: 12,
        impact: "\u0421\u0438\u043b\u0430",
        impactClass: "impact-high",
        limit: "1 \u043d\u0430 \u043f\u0435\u0440\u0441\u043e\u043d\u0430\u0436\u0430",
        note: "\u041f\u043e\u0434\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u043c\u0430\u0441\u0442\u0435\u0440"
      },
      {
        key: "feat",
        title: "\u0422\u0430\u043b\u0430\u043d\u0442 \u043f\u043e \u0441\u044e\u0436\u0435\u0442\u0443",
        blurb: "\u0422\u0435\u043c\u0430\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0439 \u043f\u0435\u0440\u043a \u0441\u0440\u0435\u0434\u043d\u0435\u0439 \u0441\u0438\u043b\u044b, \u043e\u043a\u043e\u043d\u0447\u0430\u0442\u0435\u043b\u044c\u043d\u043e \u0443\u0442\u0432\u0435\u0440\u0436\u0434\u0430\u0435\u0442 \u043c\u0430\u0441\u0442\u0435\u0440.",
        price: 15,
        impact: "\u0421\u0438\u043b\u0430",
        impactClass: "impact-high",
        limit: "1 \u0437\u0430 \u0441\u0435\u0441\u0441\u0438\u044e",
        note: "\u0421\u044e\u0436\u0435\u0442 \u0432\u0430\u0436\u043d\u0435\u0435 \u0446\u0438\u0444\u0440"
      }
    ]
  },
  {
    key: "consumables",
    title: "\u0420\u0430\u0441\u0445\u043e\u0434\u043d\u0438\u043a\u0438",
    subtitle: "\u0422\u0430\u043a\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0438\u043d\u0441\u0442\u0440\u0443\u043c\u0435\u043d\u0442\u044b \u0434\u043b\u044f \u043a\u0440\u0438\u0442\u0438\u0447\u0435\u0441\u043a\u0438\u0445 \u043c\u043e\u043c\u0435\u043d\u0442\u043e\u0432",
    items: [
      {
        key: "reroll",
        title: "\u041e\u0434\u0438\u043d \u0440\u0435\u0440\u043e\u043b\u043b",
        blurb: "\u0417\u0430\u043c\u0435\u043d\u0438 \u0440\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u043e\u0434\u043d\u043e\u0433\u043e \u0431\u0440\u043e\u0441\u043a\u0430 \u043d\u043e\u0432\u044b\u043c \u0431\u0440\u043e\u0441\u043a\u043e\u043c.",
        price: 4,
        impact: "\u0422\u0430\u043a\u0442\u0438\u043a\u0430",
        impactClass: "impact-mid",
        limit: "2 \u0437\u0430 \u0441\u0435\u0441\u0441\u0438\u044e",
        note: "\u041c\u043e\u0436\u043d\u043e \u043f\u043e\u0441\u043b\u0435 \u0431\u0440\u043e\u0441\u043a\u0430"
      },
      {
        key: "luck",
        title: "\u041f\u0435\u0447\u0430\u0442\u044c \u0443\u0434\u0430\u0447\u0438",
        blurb: "+1 \u043a \u043e\u0434\u043d\u043e\u043c\u0443 \u0431\u0440\u043e\u0441\u043a\u0443 \u0432 \u044d\u043f\u0438\u0437\u043e\u0434\u0435, \u0434\u0435\u0439\u0441\u0442\u0432\u0443\u0435\u0442 \u0434\u043e \u043a\u043e\u043d\u0446\u0430 \u0441\u0446\u0435\u043d\u044b.",
        price: 3,
        impact: "\u0422\u0430\u043a\u0442\u0438\u043a\u0430",
        impactClass: "impact-mid",
        limit: "3 \u0437\u0430 \u0441\u0435\u0441\u0441\u0438\u044e",
        note: "\u0421\u043e\u0447\u0435\u0442\u0430\u0435\u0442\u0441\u044f \u0441 \u0432\u0434\u043e\u0445\u043d\u043e\u0432\u0435\u043d\u0438\u0435\u043c"
      }
    ]
  },
  {
    key: "mystery",
    title: "\u0422\u0430\u0439\u043d\u0430\u044f \u043f\u043e\u043b\u043a\u0430",
    subtitle: "\u0420\u0438\u0441\u043a\u043e\u0432\u0430\u043d\u043d\u044b\u0435 \u043f\u043e\u043a\u0443\u043f\u043a\u0438 \u0434\u043b\u044f \u043d\u0435\u043e\u0436\u0438\u0434\u0430\u043d\u043d\u044b\u0445 \u0441\u044e\u0436\u0435\u0442\u043d\u044b\u0445 \u043f\u043e\u0432\u043e\u0440\u043e\u0442\u043e\u0432",
    items: [
      {
        key: "chest",
        title: "\u0421\u0443\u043d\u0434\u0443\u043a-\u0441\u044e\u0440\u043f\u0440\u0438\u0437",
        blurb: "\u0421\u043b\u0443\u0447\u0430\u0439\u043d\u0430\u044f \u043d\u0430\u0433\u0440\u0430\u0434\u0430 \u0438\u0437 \u043f\u0443\u043b\u0430 \u043c\u0430\u0441\u0442\u0435\u0440\u0430: \u0430\u0440\u0442\u0435\u0444\u0430\u043a\u0442, \u043a\u043b\u044e\u0447 \u0438\u043b\u0438 \u0437\u0430\u0446\u0435\u043f\u043a\u0430.",
        price: 7,
        impact: "\u0420\u0438\u0441\u043a",
        impactClass: "impact-high",
        limit: "1 \u0437\u0430 \u0441\u0435\u0441\u0441\u0438\u044e",
        note: "\u0420\u0435\u0437\u0443\u043b\u044c\u0442\u0430\u0442 \u0437\u0430\u0432\u0438\u0441\u0438\u0442 \u043e\u0442 \u0443\u0434\u0430\u0447\u0438"
      },
      {
        key: "hint",
        title: "\u0421\u0435\u043a\u0440\u0435\u0442\u043d\u0430\u044f \u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0430",
        blurb: "\u041e\u0434\u043d\u0430 \u043a\u043e\u043d\u0442\u0435\u043a\u0441\u0442\u043d\u0430\u044f \u043f\u043e\u0434\u0441\u043a\u0430\u0437\u043a\u0430 \u0434\u043b\u044f \u0441\u0446\u0435\u043d\u044b, \u043b\u043e\u043a\u0430\u0446\u0438\u0438 \u0438\u043b\u0438 NPC.",
        price: 5,
        impact: "\u0420\u0438\u0441\u043a",
        impactClass: "impact-high",
        limit: "2 \u0437\u0430 \u0441\u0435\u0441\u0441\u0438\u044e",
        note: "\u0423\u0433\u043b\u0443\u0431\u043b\u044f\u0435\u0442 \u043b\u043e\u0440 \u0438 \u0440\u0430\u0437\u0432\u0438\u043b\u043a\u0438"
      }
    ]
  }
];

function ticketWord(value) {
  const abs = Math.abs(Number(value || 0)) % 100;
  const tail = abs % 10;
  if (abs > 10 && abs < 20) return "\u0431\u0438\u043b\u0435\u0442\u043e\u0432";
  if (tail === 1) return "\u0431\u0438\u043b\u0435\u0442";
  if (tail >= 2 && tail <= 4) return "\u0431\u0438\u043b\u0435\u0442\u0430";
  return "\u0431\u0438\u043b\u0435\u0442\u043e\u0432";
}

function priceLabel(price) {
  if (!Number.isFinite(price)) return "-";
  const qty = Number(price);
  return `${qty} ${ticketWord(qty)}`;
}

export default function ShopJoe() {
  const toast = useToast();
  const { state, rules, usage, loading, err, purchase, readOnly } = useTickets();
  const balance = Number(state?.balance || 0);
  const ticketsEnabled = rules?.enabled !== false;

  async function handleBuy(itemKey) {
    if (!ticketsEnabled) {
      toast.error("\u041b\u0430\u0432\u043a\u0430 \u0437\u0430\u043a\u0440\u044b\u0442\u0430 \u043c\u0430\u0441\u0442\u0435\u0440\u043e\u043c.");
      return;
    }
    try {
      const res = await purchase({ itemKey });
      const price = res?.result?.price ?? rules?.shop?.[itemKey]?.price ?? 0;
      toast.success(`-${price} ${ticketWord(price)}`, "\u041f\u043e\u043a\u0443\u043f\u043a\u0430 \u043e\u0444\u043e\u0440\u043c\u043b\u0435\u043d\u0430");
    } catch (e) {
      const msg = formatTicketError(formatError(e));
      toast.error(msg);
    }
  }

  return (
    <div className="card taped shop-shell tavern-shop">
      <div className="row shop-hero">
        <div className="shop-hero-copy">
          <div className="shop-kicker">{"\u0422\u0435\u043c\u043d\u0430\u044f \u0442\u0430\u0432\u0435\u0440\u043d\u0430 \u2022 \u0442\u0451\u043f\u043b\u0430\u044f \u043b\u0430\u043c\u043f\u0430"}</div>
          <div className="shop-title">{"\u041b\u0430\u0432\u043a\u0430 \u0414\u0436\u043e"}</div>
          <div className="small">
            {"\u0411\u0438\u043b\u0435\u0442\u044b \u0438\u043c\u0435\u044e\u0442 \u0446\u0435\u043d\u0443: \u0447\u0435\u043c \u0441\u0438\u043b\u044c\u043d\u0435\u0435 \u044d\u0444\u0444\u0435\u043a\u0442, \u0442\u0435\u043c \u0441\u0442\u0440\u043e\u0436\u0435 \u043b\u0438\u043c\u0438\u0442\u044b."}
          </div>
        </div>
        <div className="ticket-bank">
          <div className="ticket-card">
            <div className="ticket-label">{"\u0411\u0430\u043b\u0430\u043d\u0441"}</div>
            <div className="ticket-value">{loading ? "..." : balance}</div>
          </div>
          <div className="ticket-meta small">{"\u041a\u0440\u0443\u043f\u043d\u044b\u0435 \u043f\u043e\u043a\u0443\u043f\u043a\u0438 \u043b\u0443\u0447\u0448\u0435 \u0434\u0435\u043b\u0430\u0442\u044c \u043f\u043e\u0441\u043b\u0435 \u0441\u0435\u0440\u0438\u0438 \u043f\u043e\u0431\u0435\u0434."}</div>
        </div>
      </div>

      <ShopMascotStall balance={balance} ticketsEnabled={ticketsEnabled} />

      <div className="shop-banner">
        <div className="banner-title">{"\u041a\u0430\u0436\u0434\u044b\u0439 \u0431\u0438\u043b\u0435\u0442 \u043c\u0435\u043d\u044f\u0435\u0442 \u0438\u0441\u0442\u043e\u0440\u0438\u044e"}</div>
        <div className="small">{"\u042d\u043f\u0438\u0447\u0435\u0441\u043a\u0438\u0435 \u0443\u0441\u0438\u043b\u0435\u043d\u0438\u044f \u0440\u0435\u0434\u043a\u0438, \u0430 \u0440\u0430\u0441\u0445\u043e\u0434\u043d\u0438\u043a\u0438 \u0441\u0442\u0430\u0431\u0438\u043b\u0438\u0437\u0438\u0440\u0443\u044e\u0442 \u0441\u0446\u0435\u043d\u0443."}</div>
      </div>
      {!ticketsEnabled ? (
        <div className="badge off" style={{ marginTop: 8 }}>{"\u041b\u0430\u0432\u043a\u0430 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u0437\u0430\u043a\u0440\u044b\u0442\u0430 \u043c\u0430\u0441\u0442\u0435\u0440\u043e\u043c"}</div>
      ) : null}
      {err ? <div className="badge off" style={{ marginTop: 8 }}>{"\u041e\u0448\u0438\u0431\u043a\u0430 \u0431\u0438\u043b\u0435\u0442\u043e\u0432: "}{err}</div> : null}
      <hr />

      <div className="list">
        {catalog.map((section) => (
          <div key={section.key} className="paper-note tavern-section">
            <div className="row" style={{ justifyContent: "space-between", alignItems: "baseline" }}>
              <div className="title">{section.title}</div>
              <div className="small">{section.subtitle}</div>
            </div>
            <div className="shop-grid" style={{ marginTop: 10 }}>
              {section.items.map((item) => {
                const itemRule = rules?.shop?.[item.key];
                const disabled = itemRule?.enabled === false;
                const dailyLimit = itemRule?.dailyLimit;
                const usedToday = usage?.purchasesToday?.[item.key] || 0;
                const itemPrice = resolvePrice(item.key, item.price, rules);
                return (
                  <div key={item.key} className={`item taped shop-card${disabled ? " disabled-card" : ""}`}>
                    <div className="shop-head">
                      <div className="shop-item-title">{item.title}</div>
                      <span className={`badge ${disabled ? "off" : `badge-impact ${item.impactClass}`}`}>
                        {disabled ? "\u0417\u0430\u043a\u0440\u044b\u0442\u043e" : item.impact}
                      </span>
                    </div>
                    <div className="small">{item.blurb}</div>
                    <div className="shop-meta">
                      <span className="meta-chip">
                        {"\u041b\u0438\u043c\u0438\u0442: "}{formatLimit(item.key, item.limit, dailyLimit)}
                      </span>
                      <span className="meta-chip">{item.note}</span>
                      {dailyLimit ? (
                        <span className="meta-chip">
                          {"\u0421\u0435\u0433\u043e\u0434\u043d\u044f: "}{usedToday}/{dailyLimit}
                        </span>
                      ) : null}
                    </div>
                    <div className="row shop-actions" style={{ justifyContent: "space-between" }}>
                      <span className="ticket-pill">{priceLabel(itemPrice)}</span>
                      <button
                        className="btn secondary"
                        disabled={
                          readOnly ||
                          err ||
                          !rules ||
                          !ticketsEnabled ||
                          disabled ||
                          balance < itemPrice ||
                          isLimitReached(item.key, rules, usage)
                        }
                        onClick={() => handleBuy(item.key)}
                      >
                        {"\u041a\u0443\u043f\u0438\u0442\u044c"}
                      </button>
                    </div>
                  </div>
                );
              })}
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
        viewBox="0 0 640 260"
        role="img"
        aria-label="\u041c\u0430\u0441\u043a\u043e\u0442 \u0437\u0430 \u043f\u0440\u0438\u043b\u0430\u0432\u043a\u043e\u043c"
      >
        <defs>
          <linearGradient id="shopCurtain" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2f1c18" />
            <stop offset="100%" stopColor="#120b0a" />
          </linearGradient>
          <radialGradient id="shopLampGlow" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="rgba(255, 198, 110, .95)" />
            <stop offset="60%" stopColor="rgba(255, 162, 70, .24)" />
            <stop offset="100%" stopColor="rgba(255, 140, 60, 0)" />
          </radialGradient>
          <linearGradient id="shopCounter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#744521" />
            <stop offset="100%" stopColor="#3f2412" />
          </linearGradient>
          <linearGradient id="shopMascotSkin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f7bf7e" />
            <stop offset="100%" stopColor="#d88f59" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="640" height="170" fill="url(#shopCurtain)" />

        <circle className="shop-lamp-glow" cx="498" cy="44" r="88" fill="url(#shopLampGlow)" />
        <g className="shop-lamp">
          <rect x="492" y="0" width="14" height="28" rx="5" fill="#56301a" />
          <rect x="478" y="26" width="42" height="34" rx="12" fill="#80522b" />
          <ellipse cx="499" cy="60" rx="26" ry="8" fill="rgba(255,170,82,.65)" />
        </g>

        <rect x="24" y="24" width="154" height="116" rx="10" fill="#261613" opacity=".86" />
        <rect x="462" y="24" width="154" height="116" rx="10" fill="#261613" opacity=".82" />
        <rect x="486" y="36" width="48" height="34" rx="8" fill="#6f4727" />
        <rect x="544" y="36" width="48" height="34" rx="8" fill="#6f4727" />
        <rect x="486" y="78" width="106" height="40" rx="8" fill="#6f4727" />

        <g className="shop-mascot-body">
          <ellipse cx="320" cy="136" rx="88" ry="56" fill="url(#shopMascotSkin)" />
          <circle cx="320" cy="90" r="60" fill="url(#shopMascotSkin)" />
          <ellipse
            className="shop-mascot-ear"
            cx="266"
            cy="42"
            rx="24"
            ry="38"
            fill="url(#shopMascotSkin)"
            transform="rotate(-28 266 42)"
          />
          <ellipse
            className="shop-mascot-ear shop-mascot-ear-right"
            cx="374"
            cy="42"
            rx="24"
            ry="38"
            fill="url(#shopMascotSkin)"
            transform="rotate(28 374 42)"
          />
          <g className="shop-mascot-face">
            <ellipse cx="298" cy="90" rx="16" ry="14" fill="#fff6e9" />
            <ellipse cx="342" cy="90" rx="16" ry="14" fill="#fff6e9" />
            <ellipse className="shop-mascot-eye" cx="298" cy="90" rx="7" ry="7.5" fill="#150d08" />
            <ellipse className="shop-mascot-eye" cx="342" cy="90" rx="7" ry="7.5" fill="#150d08" />
            <circle cx="301" cy="87" r="2" fill="#ffffff" />
            <circle cx="345" cy="87" r="2" fill="#ffffff" />
            <path d="M286 74 Q298 66 310 73" fill="none" stroke="#6b3f2c" strokeWidth="4" strokeLinecap="round" />
            <path d="M330 73 Q343 66 355 74" fill="none" stroke="#6b3f2c" strokeWidth="4" strokeLinecap="round" />
            <ellipse cx="320" cy="118" rx="30" ry="20" fill="#f0aa72" />
            <circle cx="308" cy="118" r="3.2" fill="#673724" />
            <circle cx="332" cy="118" r="3.2" fill="#673724" />
            <path d="M292 136 Q320 160 348 136" fill="none" stroke="#6c3f29" strokeWidth="5" strokeLinecap="round" />
            <ellipse className="shop-mascot-cheek" cx="278" cy="116" rx="9" ry="6" fill="#e58c76" opacity=".7" />
            <ellipse className="shop-mascot-cheek" cx="362" cy="116" rx="9" ry="6" fill="#e58c76" opacity=".7" />
          </g>
        </g>

        <rect x="0" y="168" width="640" height="24" fill="#2d180f" opacity=".85" />
        <rect x="0" y="192" width="640" height="68" fill="url(#shopCounter)" />
        <g className="shop-mascot-paw">
          <ellipse cx="260" cy="198" rx="44" ry="16" fill="#f4b77a" />
          <ellipse cx="380" cy="198" rx="44" ry="16" fill="#f4b77a" />
          <rect x="242" y="190" width="36" height="20" rx="9" fill="#f4b77a" />
          <rect x="362" y="190" width="36" height="20" rx="9" fill="#f4b77a" />
        </g>

        <rect x="28" y="198" width="96" height="50" rx="8" fill="#2b4a28" />
        <text x="76" y="228" textAnchor="middle" fill="#d6f2a7" fontSize="17" fontWeight="800">
          x1
        </text>
        <circle cx="142" cy="223" r="13" fill="#e8bf67" />
      </svg>
      <div className="shop-mascot-bubble" aria-live="polite">
        <span className="shop-mascot-name">{"\u0414\u0416\u041e, \u0425\u041e\u0417\u042f\u0418\u041d \u041b\u0410\u0412\u041a\u0418"}</span>
        <span>{line}</span>
      </div>
    </div>
  );
}

function getMascotLine(balance, ticketsEnabled) {
  if (!ticketsEnabled) return "\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u043f\u0440\u0438\u043b\u0430\u0432\u043e\u043a \u0437\u0430\u043a\u0440\u044b\u0442 \u043c\u0430\u0441\u0442\u0435\u0440\u043e\u043c. \u0417\u0430\u0433\u043b\u044f\u043d\u0438 \u043f\u043e\u0437\u0436\u0435.";
  if (balance <= 2) return "\u041d\u0430\u0447\u043d\u0438 \u0441 \u043f\u0435\u0447\u0430\u0442\u0438 \u0443\u0434\u0430\u0447\u0438 \u0438 \u0440\u0435\u0440\u043e\u043b\u043b\u043e\u0432. \u042d\u0442\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0439 \u0441\u0442\u0430\u0440\u0442.";
  if (balance >= 12) return "\u0423 \u0442\u0435\u0431\u044f \u0445\u0432\u0430\u0442\u0438\u0442 \u0431\u0438\u043b\u0435\u0442\u043e\u0432 \u043d\u0430 \u0441\u0435\u0440\u044c\u0451\u0437\u043d\u043e\u0435 \u0443\u0441\u0438\u043b\u0435\u043d\u0438\u0435.";
  return "\u0412\u044b\u0431\u0438\u0440\u0430\u0439 \u0430\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u043e: \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0430\u044f \u0441\u0446\u0435\u043d\u0430 \u043c\u043e\u0436\u0435\u0442 \u0440\u0435\u0437\u043a\u043e \u043f\u0435\u0440\u0435\u0432\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f.";
}

function resolvePrice(itemKey, fallback, rules) {
  const price = rules?.shop?.[itemKey]?.price;
  return Number.isFinite(price) ? price : Number(fallback || 0);
}

function formatLimit(itemKey, fallback, dailyLimit) {
  if (dailyLimit) return `\u0434\u043e ${dailyLimit} \u0432 \u0434\u0435\u043d\u044c`;
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
  if (c === "tickets_disabled") return "\u041b\u0430\u0432\u043a\u0430 \u0432\u0440\u0435\u043c\u0435\u043d\u043d\u043e \u0437\u0430\u043a\u0440\u044b\u0442\u0430.";
  if (c === "item_disabled") return "\u042d\u0442\u043e\u0442 \u0442\u043e\u0432\u0430\u0440 \u0441\u0435\u0439\u0447\u0430\u0441 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.";
  if (c === "not_enough_tickets") return "\u041d\u0435\u0434\u043e\u0441\u0442\u0430\u0442\u043e\u0447\u043d\u043e \u0431\u0438\u043b\u0435\u0442\u043e\u0432 \u0434\u043b\u044f \u043f\u043e\u043a\u0443\u043f\u043a\u0438.";
  if (c === "daily_item_limit") return "\u0414\u043d\u0435\u0432\u043d\u043e\u0439 \u043b\u0438\u043c\u0438\u0442 \u043f\u043e \u044d\u0442\u043e\u043c\u0443 \u0442\u043e\u0432\u0430\u0440\u0443 \u0438\u0441\u0447\u0435\u0440\u043f\u0430\u043d.";
  if (c === "daily_spend_cap") return "\u0414\u043e\u0441\u0442\u0438\u0433\u043d\u0443\u0442 \u0434\u043d\u0435\u0432\u043d\u043e\u0439 \u043b\u0438\u043c\u0438\u0442 \u0442\u0440\u0430\u0442.";
  if (c === "invalid_item") return "\u0422\u043e\u0432\u0430\u0440 \u043d\u0435\u0434\u043e\u0441\u0442\u0443\u043f\u0435\u043d.";
  return c || "\u041e\u0448\u0438\u0431\u043a\u0430 \u043f\u043e\u043a\u0443\u043f\u043a\u0438";
}
