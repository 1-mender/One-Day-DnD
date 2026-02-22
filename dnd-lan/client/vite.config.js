import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendPort = Number(globalThis.process?.env?.PORT || 3000);
const backendTarget = globalThis.process?.env?.VITE_DEV_PROXY_TARGET || `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("react-dom") || id.includes("react")) return "vendor-react";
          if (id.includes("socket.io-client")) return "vendor-socket";
          if (id.includes("react-markdown") || id.includes("remark-gfm") || id.includes("rehype-sanitize")) return "vendor-markdown";
          if (id.includes("@motionone") || id.includes("@formkit/auto-animate")) return "vendor-motion";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("qrcode")) return "vendor-qrcode";
          return;
        }
      }
    }
  },
  server: {
    host: true,
    proxy: {
      "/api": { target: backendTarget, changeOrigin: true },
      "/uploads": { target: backendTarget, changeOrigin: true },
      "/socket.io": { target: backendTarget, changeOrigin: true, ws: true }
    }
  }
});
