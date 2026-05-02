import { fileURLToPath } from "node:url";
import preact from "@preact/preset-vite";
import UnpluginTypia from "@typia/unplugin/vite";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [UnpluginTypia({ tsconfig: "./tsconfig.json" }), preact()],
  test: {
    name: "unit",
    environment: "jsdom",
    globals: true,
    include: ["tests/**/*.{test,spec}.{ts,tsx}"],
    exclude: ["tests/browser/**", "tests/**/*.browser.{test,spec}.{ts,tsx}"],
    typecheck: {
      include: ["tests/**/*.test-d.ts"],
      tsconfig: "./tsconfig.json",
    },
    coverage: {
      provider: "v8",
      include: ["src/**"],
      reporter: ["text", "json", "html"],
      thresholds: {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
      exclude: [
        "src/index.tsx",
        "src/prerender.tsx",
        "src/lib/mockHydrate.ts",
        "src/services/storage.ts",
        "src/components/ProgressBar.tsx",
        "src/**/*.d.ts",
      ],
    },
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
