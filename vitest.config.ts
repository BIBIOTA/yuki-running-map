import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./"),
    },
  },
  test: {
    environment: "node",
    include: [
      "lib/**/__tests__/**/*.test.ts",
      "lib/**/*.test.ts",
      "features/**/__tests__/**/*.test.ts",
      "features/**/*.test.ts",
    ],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["lib/gpx/**/*.ts"],
      exclude: [
        "lib/gpx/**/__tests__/**",
        "lib/gpx/**/__fixtures__/**",
        "lib/gpx/index.ts",
        "lib/gpx/types.ts",
      ],
      thresholds: {
        statements: 80,
        branches: 70,
        functions: 80,
        lines: 80,
      },
    },
  },
});
