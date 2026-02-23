import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import "./styles/vintage.css";
import "@fontsource/cinzel";
import "@fontsource/special-elite";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";
import ErrorBoundary from "./components/ui/ErrorBoundary.jsx";
import { applyThemeAssets } from "./theme/themeAssets.js";
import { applyUiVariant, cycleUiVariant } from "./theme/uiVariant.js";
import "./styles/ui-variants.css";

function showBootstrapError(error) {
  const root = document.getElementById("root") || document.body;
  if (!root) return;
  const message = typeof error?.message === "string" && error.message
    ? error.message
    : "bootstrap_failed";
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.padding = "16px";
  wrap.style.fontFamily = "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial";
  wrap.style.background = "#f6ead1";
  wrap.style.color = "#2b2216";
  wrap.style.minHeight = "100vh";
  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.fontSize = "18px";
  title.textContent = "UI bootstrap error";
  const details = document.createElement("pre");
  details.style.whiteSpace = "pre-wrap";
  details.style.marginTop = "10px";
  details.textContent = message;
  wrap.appendChild(title);
  wrap.appendChild(details);
  root.appendChild(wrap);
}

let bootOk = true;
try {
  applyThemeAssets();
  applyUiVariant();
} catch (e) {
  bootOk = false;
  showBootstrapError(e);
  console.error("[bootstrap] init failed", e);
}

if (bootOk && typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === "KeyU") {
      e.preventDefault();
      cycleUiVariant();
    }
  });
}

if (bootOk) {
  try {
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <ErrorBoundary>
          <ToastProvider>
            <BrowserRouter>
              <App />
            </BrowserRouter>
          </ToastProvider>
        </ErrorBoundary>
      </React.StrictMode>
    );
  } catch (e) {
    showBootstrapError(e);
    console.error("[bootstrap] render failed", e);
  }
}
