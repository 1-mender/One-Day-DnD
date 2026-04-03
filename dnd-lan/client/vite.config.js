import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const backendPort = Number(globalThis.process?.env?.PORT || 3000);
const backendTarget = globalThis.process?.env?.VITE_DEV_PROXY_TARGET || `http://127.0.0.1:${backendPort}`;

export default defineConfig({
  plugins: [react()],
  build: {
    target: "es2018",
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("react-router")) return "vendor-router";
          if (id.includes("socket.io-client")) return "vendor-socket";
          if (
            id.includes("react-markdown")
            || id.includes("remark-")
            || id.includes("rehype-")
            || id.includes("micromark")
            || id.includes("mdast-")
            || id.includes("hast-")
            || id.includes("unified")
            || id.includes("unist-")
            || id.includes("vfile")
          ) return "vendor-markdown";
          if (id.includes("@motionone") || id.includes("@formkit/auto-animate")) return "vendor-motion";
          if (id.includes("qrcode")) return "vendor-qrcode";
          if (id.includes("react-dom") || id.includes("react")) return "vendor-react";
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
