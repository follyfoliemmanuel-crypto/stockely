import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    exclude: ["tests/e2e/**", "node_modules/**"],
    setupFiles: ["tests/setup-env.ts"],
    fileParallelism: false,
    // Les tests d'intégration écrivent sur une base distante : le temps
    // d'aller-retour dépasse parfois 30 s. Le test de cycle complet des
    // transferts porte en plus son propre délai de 120 s.
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
