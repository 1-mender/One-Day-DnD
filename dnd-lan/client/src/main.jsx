import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App.jsx";
import "./styles.css";
import "./styles/vintage.css";
import { ToastProvider } from "./components/ui/ToastProvider.jsx";
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
    <ToastProvider>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </ToastProvider>
  </React.StrictMode>
);
