import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
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
