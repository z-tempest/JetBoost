import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

// Plain @vitejs/plugin-react (v4.x) with no babel: {} option — deliberately
// avoids the rolldown-vite / @rolldown/plugin-babel split that ships in
// plugin-react v6+. If you upgrade plugin-react later and start passing
// custom babel plugins here, you'll need to add @rolldown/plugin-babel
// as its own dependency at that point.
export default defineConfig({
  plugins: [react()],
  base: "/JetBoost/",
  server: {
    // Forward /api/* to the FastAPI inference service on localhost:8000
    // (stripping the /api prefix, so /api/predict -> :8000/predict). Going
    // through Vite's dev server also avoids CORS, which inference.py
    // doesn't enable.
    proxy: {
      "/api": {
        target: "http://localhost:8000",
        changeOrigin: true,
        rewrite: (p) => p.replace(/^\/api/, ""),
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
