import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { visualizer } from "rollup-plugin-visualizer";

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    ...(mode === "analyze"
      ? [
          visualizer({
            filename: "dist/stats.html",
            open: false,
            gzipSize: true,
            brotliSize: true,
          }),
        ]
      : []),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (
            id.includes("/node_modules/react/") ||
            id.includes("/node_modules/react-dom/") ||
            id.includes("/node_modules/scheduler/")
          ) {
            return "react-core";
          }
          if (id.includes("/node_modules/@tiptap/") || id.includes("/node_modules/prosemirror-")) {
            return "editor";
          }
          if (id.includes("/node_modules/@supabase/")) {
            return "supabase";
          }
          if (id.includes("/node_modules/react-window/")) {
            return "react-window";
          }
          if (id.includes("react-router-dom") || id.includes("@remix-run/router")) {
            return "router";
          }
          if (id.includes("i18next") || id.includes("react-i18next")) {
            return "i18n";
          }
          if (id.includes("dexie") || id.includes("zustand")) {
            return "state-storage";
          }
          return "vendor";
        },
      },
    },
  },
}));
