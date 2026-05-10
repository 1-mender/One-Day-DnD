function hasKnownWidthParam(src) {
  return /[?&](w|width)=\d+/i.test(src);
}

function addWidthParam(src, width) {
  if (!src || /^(data:|blob:)/i.test(src)) return src;
  if (hasKnownWidthParam(src)) return src;
  const joiner = src.includes("?") ? "&" : "?";
  return `${src}${joiner}w=${width}`;
}

export function buildSrcSet(src, widths) {
  if (!src || !Array.isArray(widths) || widths.length === 0) return undefined;
  const base = String(src);
  if (/^(data:|blob:)/i.test(base)) return undefined;
  if (hasKnownWidthParam(base)) return undefined;
  return widths.map((w) => `${addWidthParam(base, w)} ${w}w`).join(", ");
}

const POLAROID_SIZES = {
  default: { size: 78, sizes: "(max-width: 900px) 68px, 78px", srcset: [68, 78, 136, 156] },
  lg: { size: 120, sizes: "(max-width: 900px) 96px, 120px", srcset: [96, 120, 192, 240] },
  sm: { size: 64, sizes: "64px", srcset: [64, 128] },
  qr: { size: 180, sizes: "(max-width: 900px) 140px, 180px", srcset: [140, 180, 280, 360] }
};

export function getPolaroidImageProps(src, className = "") {
  const classes = String(className).split(/\s+/).filter(Boolean);
  const key = classes.find((c) => c === "lg" || c === "sm" || c === "qr") || "default";
  const cfg = POLAROID_SIZES[key] || POLAROID_SIZES.default;
  return {
    width: cfg.size,
    height: cfg.size,
    sizes: cfg.sizes,
    srcSet: buildSrcSet(src, cfg.srcset)
  };
}

const INVENTORY_IMAGE = {
  width: 320,
  height: 140,
  sizes: "(max-width: 720px) 92vw, (max-width: 1200px) 45vw, 320px",
  srcset: [320, 480, 640]
};

export function getInventoryImageProps(src) {
  return {
    width: INVENTORY_IMAGE.width,
    height: INVENTORY_IMAGE.height,
    sizes: INVENTORY_IMAGE.sizes,
    srcSet: buildSrcSet(src, INVENTORY_IMAGE.srcset)
  };
}
