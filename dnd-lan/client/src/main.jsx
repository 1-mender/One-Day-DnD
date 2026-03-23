import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./foundation/tokens.css";
import "./styles/layers.css";
import "./styles.css";
import "./styles/vintage.css";
import "./styles/cartographer.css";
import "@fontsource/eb-garamond";
import "@fontsource/im-fell-english";
import { ToastProvider } from "./foundation/providers/index.js";
import { ErrorBoundary } from "./foundation/primitives/index.js";
import { t } from "./i18n/index.js";

function showBootstrapError(error) {
  const root = document.getElementById("root") || document.body;
  if (!root) return;
  const message = typeof error?.message === "string" && error.message
    ? error.message
    : t("bootstrap.errorFallbackCode");
  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.style.padding = "16px";
  wrap.style.fontFamily = "\"EB Garamond\", \"IM Fell English\", ui-serif, Georgia, serif";
  wrap.style.background = "#f4f1e6";
  wrap.style.color = "#2e2a1e";
  wrap.style.minHeight = "100vh";
  const title = document.createElement("div");
  title.style.fontWeight = "700";
  title.style.fontSize = "18px";
  title.textContent = t("bootstrap.errorTitle");
  const details = document.createElement("pre");
  details.style.whiteSpace = "pre-wrap";
  details.style.marginTop = "10px";
  details.textContent = message;
  wrap.appendChild(title);
  wrap.appendChild(details);
  root.appendChild(wrap);
}

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
