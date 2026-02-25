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
            <stop offset="0%" stopColor="#2b3126" />
            <stop offset="100%" stopColor="#161a12" />
          </linearGradient>
          <linearGradient id="shopAwning" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="#6d4e2f" />
            <stop offset="45%" stopColor="#8a6339" />
            <stop offset="100%" stopColor="#6b4c2e" />
          </linearGradient>
          <radialGradient id="shopLampGlow" cx="50%" cy="50%" r="65%">
            <stop offset="0%" stopColor="rgba(255, 219, 144, .95)" />
            <stop offset="60%" stopColor="rgba(237, 179, 90, .24)" />
            <stop offset="100%" stopColor="rgba(226, 160, 70, 0)" />
          </radialGradient>
          <linearGradient id="shopCounter" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6e4d2d" />
            <stop offset="100%" stopColor="#3b2818" />
          </linearGradient>
          <linearGradient id="shopMascotSkin" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f8c993" />
            <stop offset="100%" stopColor="#d99b66" />
          </linearGradient>
          <linearGradient id="shopEarInner" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#f4ad92" />
            <stop offset="100%" stopColor="#d28065" />
          </linearGradient>
          <linearGradient id="shopApron" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#566949" />
            <stop offset="100%" stopColor="#394730" />
          </linearGradient>
          <linearGradient id="shopCoin" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ffe39d" />
            <stop offset="100%" stopColor="#d4a451" />
          </linearGradient>
          <linearGradient id="shopBottle" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#88a36a" />
            <stop offset="100%" stopColor="#4f643c" />
          </linearGradient>
        </defs>

        <rect x="0" y="0" width="640" height="170" fill="url(#shopCurtain)" />
        <path d="M0 12 H640 V36 C602 44 550 54 486 54 C418 54 380 40 320 40 C260 40 226 54 154 54 C96 54 42 46 0 38 Z" fill="url(#shopAwning)" opacity=".96" />
        <path d="M0 36 C42 46 96 54 154 54 C226 54 260 40 320 40 C380 40 418 54 486 54 C550 54 602 44 640 36 V54 H0 Z" fill="rgba(255,226,173,.15)" />

        <circle className="shop-lamp-glow" cx="500" cy="46" r="88" fill="url(#shopLampGlow)" />
        <g className="shop-lamp">
          <rect x="494" y="0" width="12" height="26" rx="5" fill="#5e4428" />
          <rect x="476" y="24" width="48" height="38" rx="14" fill="#87643e" />
          <ellipse cx="500" cy="62" rx="28" ry="9" fill="rgba(255,191,109,.7)" />
        </g>

        <rect x="24" y="28" width="154" height="112" rx="10" fill="#231a14" opacity=".88" />
        <rect x="462" y="28" width="154" height="112" rx="10" fill="#231a14" opacity=".86" />
        <rect x="46" y="48" width="110" height="12" rx="6" fill="#6f5134" />
        <rect x="46" y="86" width="110" height="12" rx="6" fill="#6f5134" />
        <rect x="486" y="40" width="48" height="34" rx="8" fill="#6f5134" />
        <rect x="544" y="40" width="48" height="34" rx="8" fill="#6f5134" />
        <rect x="486" y="82" width="106" height="40" rx="8" fill="#6f5134" />
        <rect x="70" y="58" width="18" height="24" rx="6" fill="url(#shopBottle)" />
        <rect x="106" y="58" width="18" height="24" rx="6" fill="#7f5d3f" />
        <circle cx="557" cy="56" r="7" fill="url(#shopCoin)" />
        <circle cx="576" cy="56" r="7" fill="url(#shopCoin)" />

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
          <ellipse cx="266" cy="46" rx="12" ry="22" fill="url(#shopEarInner)" transform="rotate(-28 266 46)" />
          <ellipse
            className="shop-mascot-ear shop-mascot-ear-right"
            cx="374"
            cy="42"
            rx="24"
            ry="38"
            fill="url(#shopMascotSkin)"
            transform="rotate(28 374 42)"
          />
          <ellipse cx="374" cy="46" rx="12" ry="22" fill="url(#shopEarInner)" transform="rotate(28 374 46)" />
          <path d="M268 52 Q320 16 372 52 L360 68 Q320 42 280 68 Z" fill="#4a5e40" />
          <rect x="288" y="58" width="64" height="16" rx="8" fill="#d5a95d" opacity=".92" />
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
            <path d="M299 132 Q320 144 341 132" fill="none" stroke="#5e3926" strokeWidth="3" strokeLinecap="round" />
            <path d="M292 136 Q320 160 348 136" fill="none" stroke="#6c3f29" strokeWidth="5" strokeLinecap="round" />
            <ellipse className="shop-mascot-cheek" cx="278" cy="116" rx="9" ry="6" fill="#e58c76" opacity=".7" />
            <ellipse className="shop-mascot-cheek" cx="362" cy="116" rx="9" ry="6" fill="#e58c76" opacity=".7" />
          </g>
          <path d="M270 140 Q320 166 370 140 V194 H270 Z" fill="url(#shopApron)" opacity=".98" />
          <rect x="306" y="150" width="28" height="18" rx="6" fill="#e8d7b6" opacity=".9" />
        </g>

        <rect x="0" y="168" width="640" height="24" fill="#2d180f" opacity=".85" />
        <rect x="0" y="192" width="640" height="68" fill="url(#shopCounter)" />
        <g className="shop-mascot-paw">
          <ellipse cx="260" cy="198" rx="44" ry="16" fill="#f4b77a" />
          <ellipse cx="380" cy="198" rx="44" ry="16" fill="#f4b77a" />
          <rect x="242" y="190" width="36" height="20" rx="9" fill="#f4b77a" />
          <rect x="362" y="190" width="36" height="20" rx="9" fill="#f4b77a" />
        </g>

        <rect x="28" y="198" width="96" height="50" rx="8" fill="#415a33" />
        <text x="76" y="228" textAnchor="middle" fill="#e5f5c0" fontSize="17" fontWeight="800">
          x1
        </text>
        <circle cx="144" cy="223" r="13" fill="url(#shopCoin)" />
        <rect x="516" y="198" width="88" height="48" rx="8" fill="#25321f" />
        <text x="560" y="222" textAnchor="middle" fill="#f2dfba" fontSize="14" fontWeight="700">
          JOE
        </text>
        <text x="560" y="238" textAnchor="middle" fill="#b8d28d" fontSize="12" fontWeight="700">
          GOODS
        </text>
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
