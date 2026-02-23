import React from "react";

const LABEL_MASCOT = "\u041c\u0430\u0441\u043a\u043e\u0442 \u0437\u0430 \u043f\u0440\u0438\u043b\u0430\u0432\u043a\u043e\u043c";
const NAME_MASCOT = "\u0414\u0416\u041e, \u0425\u041e\u0417\u042f\u0418\u041d \u041b\u0410\u0412\u041a\u0418";

export default function ShopMascotStall({ balance, ticketsEnabled }) {
  const line = getMascotLine(balance, ticketsEnabled);
  return (
    <div className="shop-mascot-stall">
      <svg
        className="shop-mascot-svg"
        viewBox="0 0 640 260"
        role="img"
        aria-label={LABEL_MASCOT}
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
        <span className="shop-mascot-name">{NAME_MASCOT}</span>
        <span>{line}</span>
      </div>
    </div>
  );
}

function getMascotLine(balance, ticketsEnabled) {
  if (!ticketsEnabled) {
    return "\u0421\u0435\u0433\u043e\u0434\u043d\u044f \u043f\u0440\u0438\u043b\u0430\u0432\u043e\u043a \u0437\u0430\u043a\u0440\u044b\u0442 \u043c\u0430\u0441\u0442\u0435\u0440\u043e\u043c. \u0417\u0430\u0433\u043b\u044f\u043d\u0438 \u043f\u043e\u0437\u0436\u0435.";
  }
  if (balance <= 2) {
    return "\u041d\u0430\u0447\u043d\u0438 \u0441 \u043f\u0435\u0447\u0430\u0442\u0438 \u0443\u0434\u0430\u0447\u0438 \u0438 \u0440\u0435\u0440\u043e\u043b\u043b\u043e\u0432. \u042d\u0442\u043e \u0431\u0435\u0437\u043e\u043f\u0430\u0441\u043d\u044b\u0439 \u0441\u0442\u0430\u0440\u0442.";
  }
  if (balance >= 12) {
    return "\u0423 \u0442\u0435\u0431\u044f \u0445\u0432\u0430\u0442\u0438\u0442 \u0431\u0438\u043b\u0435\u0442\u043e\u0432 \u043d\u0430 \u0441\u0435\u0440\u044c\u0451\u0437\u043d\u043e\u0435 \u0443\u0441\u0438\u043b\u0435\u043d\u0438\u0435.";
  }
  return "\u0412\u044b\u0431\u0438\u0440\u0430\u0439 \u0430\u043a\u043a\u0443\u0440\u0430\u0442\u043d\u043e: \u0441\u043b\u0435\u0434\u0443\u044e\u0449\u0430\u044f \u0441\u0446\u0435\u043d\u0430 \u043c\u043e\u0436\u0435\u0442 \u0440\u0435\u0437\u043a\u043e \u043f\u0435\u0440\u0435\u0432\u0435\u0440\u043d\u0443\u0442\u044c\u0441\u044f.";
}
