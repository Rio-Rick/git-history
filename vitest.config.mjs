import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        test: {
          name: "webview",
          globals: true,
          environment: "jsdom",
          include: ["webview/**/*.test.{js,jsx}"],
          setupFiles: ["webview/test-setup.js"]
        }
      },
      {
        test: {
          name: "extension",
          globals: true,
          environment: "node",
          include: ["extension/**/*.test.js", "test/**/*.test.js"],
          testTimeout: 60000
        }
      }
    ]
  }
});
