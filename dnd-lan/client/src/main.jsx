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

applyThemeAssets();
applyUiVariant();

if (typeof window !== "undefined") {
  window.addEventListener("keydown", (e) => {
    if (e.ctrlKey && e.shiftKey && e.code === "KeyU") {
      e.preventDefault();
      cycleUiVariant();
    }
  });
}

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
