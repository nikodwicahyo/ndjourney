import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    environment: "node",
    globals: false,
    setupFiles: ["tests/integration/setup.ts"],
    include: ["tests/unit/**/*.test.{ts,tsx}", "tests/integration/**/*.test.{ts,tsx}"],
    exclude: ["node_modules", ".next", "tests/e2e/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "lcov"],
      include: ["lib/**/*.ts"],
      exclude: ["lib/generated/**", "lib/__tests__/**"],
    },
  },
});
