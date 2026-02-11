import backWebp from "../assets/ui/Back.webp";
import backAvif from "../assets/ui/Back.avif";
import bookWebp from "../assets/ui/book.webp";
import bookAvif from "../assets/ui/book.avif";
import plenkaWebp from "../assets/ui/Plenka.webp";
import plenkaAvif from "../assets/ui/Plenka.avif";
import tapeWebp from "../assets/ui/tape.webp";
import tapeAvif from "../assets/ui/tape.avif";

function loadRarityTextures() {
  const glob = import.meta.glob("../assets/ui/*Rang*.{webp,avif}", {
    eager: true,
    query: "?url",
    import: "default"
  });

  const grouped = {};
  for (const [path, url] of Object.entries(glob)) {
    const file = path.split("/").pop()?.toLowerCase() || "";
    const match = file.match(/^(.*)\.(webp|avif)$/);
    if (!match) continue;
    const name = match[1];
    const ext = match[2];
    if (!grouped[name]) grouped[name] = {};
    grouped[name][ext] = url;
  }

  const out = {};
  for (const [name, assets] of Object.entries(grouped)) {
    const key =
      name.includes("very") || name.includes("violet") || name.includes("purple") ? "very_rare"
      : name.includes("legend") || name.includes("gold") || name.includes("yellow") || name.includes("orange") ? "legendary"
      : name.includes("uncommon") || name.includes("green") ? "uncommon"
      : name.includes("common") || name.includes("grey") || name.includes("gray") ? "common"
      : name.includes("rare") || name.includes("blue") ? "rare"
      : name.includes("custom") ? "custom"
      : null;

    if (key) out[key] = assets;
  }
  return out;
}

function buildImageSet(assets) {
  if (!assets) return "none";
  const parts = [];
  if (assets.avif) parts.push(`url("${assets.avif}") type("image/avif")`);
  if (assets.webp) parts.push(`url("${assets.webp}") type("image/webp")`);
  if (assets.png) parts.push(`url("${assets.png}") type("image/png")`);
  if (!parts.length) return "none";
  return `image-set(${parts.join(", ")})`;
}

function resolveImage(assets) {
  if (!assets) return "none";
  const supportsImageSet = typeof CSS !== "undefined"
    && typeof CSS.supports === "function"
    && CSS.supports("background-image", 'image-set(url("x") 1x)');
  if (supportsImageSet) return buildImageSet(assets);
  const fallback = assets.webp || assets.avif || assets.png;
  return fallback ? `url("${fallback}")` : "none";
}

export function applyThemeAssets() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const lite = shouldEnableLiteMode();

  if (lite) {
    root.classList.add("theme-lite");
  }

  const backAssets = { webp: backWebp, avif: backAvif };
  const bookAssets = { webp: bookWebp, avif: bookAvif };
  const plenkaAssets = { webp: plenkaWebp, avif: plenkaAvif };
  const tapeAssets = { webp: tapeWebp, avif: tapeAvif };

  root.style.setProperty("--tex-back", lite ? "none" : resolveImage(backAssets));
  root.style.setProperty("--tex-book", lite ? "none" : resolveImage(bookAssets));
  root.style.setProperty("--tex-plenka", lite ? "none" : resolveImage(plenkaAssets));
  root.style.setProperty("--tex-tape", lite ? "none" : resolveImage(tapeAssets));

  const rar = loadRarityTextures();
  for (const [k, assets] of Object.entries(rar)) {
    root.style.setProperty(`--tex-rang-${k}`, resolveImage(assets));
  }

  if (!lite) {
    const checks = [
      { key: "--tex-back", url: backWebp || backAvif },
      { key: "--tex-book", url: bookWebp || bookAvif },
      { key: "--tex-plenka", url: plenkaWebp || plenkaAvif },
      { key: "--tex-tape", url: tapeWebp || tapeAvif }
    ];

    for (const c of checks) {
      const img = new Image();
      img.onerror = () => {
        root.style.setProperty(c.key, "none");
        root.classList.add("theme-no-textures");
      };
      img.src = c.url;
    }
  }
}

function shouldEnableLiteMode() {
  if (typeof window === "undefined") return false;
  const smallScreen = window.matchMedia?.("(max-width: 720px)")?.matches;
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;

  let lowEnd = false;
  if (typeof navigator !== "undefined") {
    const lowMem = typeof navigator.deviceMemory === "number" && navigator.deviceMemory <= 4;
    const lowCpu = typeof navigator.hardwareConcurrency === "number" && navigator.hardwareConcurrency <= 4;
    const saveData = !!navigator.connection?.saveData;
    lowEnd = lowMem || lowCpu || saveData;
  }

  return !!(smallScreen || reducedMotion || lowEnd);
}
