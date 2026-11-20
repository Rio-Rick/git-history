import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Builds the page of the webview as one plain script and one stylesheet:
// they are what the extension loads (see extension/webview-html.js).
export default defineConfig({
  root: "webview",
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production")
  },
  build: {
    outDir: "../dist/webview",
    emptyOutDir: true,
    sourcemap: false,
    cssCodeSplit: false,
    lib: {
      entry: "src/main.jsx",
      formats: ["iife"],
      name: "GitFileHistoryNav",
      fileName: () => "main.js",
      cssFileName: "main"
    }
  }
});
