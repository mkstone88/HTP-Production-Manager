import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: [
      // The `server-only` package throws outside a React Server environment;
      // stub it so pure logic inside server modules stays unit-testable.
      { find: "server-only", replacement: path.resolve(__dirname, "tests/stubs/server-only.ts") },
      { find: /^@\//, replacement: `${path.resolve(__dirname)}/` },
    ],
  },
  test: {
    include: ["lib/**/*.test.ts", "tests/**/*.test.ts"],
  },
});
