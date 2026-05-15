import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "node",
    include: ["**/*.test.{ts,tsx}"],
    passWithNoTests: true,
    exclude: [
      "**/node_modules/**",
      "**/.next/**",
      "**/dist/**",
      ".claude/**",
      "arch/**",
      ".develop-team/**",
      ".review-fix/**",
      ".review-team/**",
      ".planning/**",
      "playwright-qa-screenshots/**",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
