import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

const useHttps = process.env.VITE_DEV_HTTPS === "true";
const apiProxyTarget = process.env.VITE_API_PROXY_TARGET || "http://127.0.0.1:8001";
const basePath = process.env.VITE_BASE_PATH || "/";

export default defineConfig({
  base: basePath,
  plugins: [react()],
  server: {
    host: true,
    strictPort: true,
    port: 5185,
    https: useHttps,
    proxy: {
      "/api": {
        target: apiProxyTarget,
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
});
