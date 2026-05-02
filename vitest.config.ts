/**
 * refero-mcp — vitest 4.x configuration.
 *
 * Hard requirements:
 *  - Each test file gets its own isolated environment (no shared FS state
 *    between files). We achieve that via `pool: 'forks'` + `isolate: true`,
 *    so per-test mkdtempSync paths can never leak.
 *  - Coverage thresholds at 80% for lines/functions/statements, 75% for
 *    branches — matches the project quality bar.
 *  - Coverage scope is `src/**` only (the public surface area). Test fixtures
 *    and the test suite itself are excluded from numerator + denominator.
 *  - We DO NOT install a global fetch mock here. Each refero/cache test file
 *    stubs `fetch` (or skips network) per-test via `vi.stubGlobal` and clears
 *    on teardown. A global stub would silently mask "test forgot to mock"
 *    bugs and the integration test in `tools.test.ts` still needs file-scoped
 *    stubs anyway.
 *
 * Author: Nate Davidovich (Lorecraft LLC)
 */
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    globals: false,

    include: ["tests/**/*.test.ts"],
    exclude: ["node_modules", "dist", ".git", "tests/fixtures/**"],

    // Each test file runs in its own worker → no FS cross-talk.
    // (vitest 4: `poolOptions` was hoisted to top-level — see migration guide.)
    pool: "forks",
    isolate: true,

    // Mock hygiene — every test starts from a clean slate.
    mockReset: true,
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    unstubEnvs: true,

    testTimeout: 15_000,
    hookTimeout: 10_000,

    coverage: {
      enabled: false, // turned on by `npm run test -- --coverage` or CI
      provider: "v8",
      reporter: ["text", "json-summary", "html"],
      reportsDirectory: "./coverage",
      include: ["src/**/*.ts"],
      exclude: [
        "**/*.d.ts",
        "src/cli.ts", // stdio entrypoint, exercised at boot time only
        "src/server.ts", // MCP wire-up, exercised via stdio integration
        "src/types.ts", // pure type declarations, no runtime code
        "src/**/index.ts",
      ],
      thresholds: {
        lines: 80,
        functions: 80,
        statements: 80,
        branches: 75,
      },
    },

    reporters: ["default"],
  },
});
