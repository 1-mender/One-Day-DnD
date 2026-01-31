import backUrl from "../assets/ui/Back.png";
import bookUrl from "../assets/ui/book.png";
import plenkaUrl from "../assets/ui/Plenka.png";
import tapeUrl from "../assets/ui/tape.png";

function loadRarityTextures() {
  const glob = import.meta.glob("../assets/ui/*Rang*.png", {
    eager: true,
    query: "?url",
    import: "default"
  });

  const out = {};
  for (const [path, url] of Object.entries(glob)) {
    const file = path.split("/").pop()?.toLowerCase() || "";
    const key =
      file.includes("very") || file.includes("violet") || file.includes("purple") ? "very_rare"
      : file.includes("legend") || file.includes("gold") || file.includes("yellow") || file.includes("orange") ? "legendary"
      : file.includes("uncommon") || file.includes("green") ? "uncommon"
      : file.includes("common") || file.includes("grey") || file.includes("gray") ? "common"
      : file.includes("rare") || file.includes("blue") ? "rare"
      : file.includes("custom") ? "custom"
      : null;

    if (key) out[key] = url;
  }
  return out;
}

export function applyThemeAssets() {
  if (typeof document === "undefined") return;
  const root = document.documentElement;

  root.style.setProperty("--tex-back", `url("${backUrl}")`);
  root.style.setProperty("--tex-book", `url("${bookUrl}")`);
  root.style.setProperty("--tex-plenka", `url("${plenkaUrl}")`);
  root.style.setProperty("--tex-tape", `url("${tapeUrl}")`);

  const rar = loadRarityTextures();
  for (const [k, url] of Object.entries(rar)) {
    root.style.setProperty(`--tex-rang-${k}`, `url("${url}")`);
  }

  const checks = [
    { key: "--tex-back", url: backUrl },
    { key: "--tex-book", url: bookUrl },
    { key: "--tex-plenka", url: plenkaUrl },
    { key: "--tex-tape", url: tapeUrl }
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
