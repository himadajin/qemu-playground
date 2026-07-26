import { defineConfig } from "vitest/config";

export default defineConfig({
  // The shared package is a TypeScript-source workspace link, so it has to be
  // transformed by Vite instead of being externalized as a plain node module.
  ssr: { noExternal: ["@qemu-playground/shared"] },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // Integration tests start real runner containers (image pull/start plus
    // compilation under QEMU), which is far slower than the default budget.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Runs are deliberately capped by a small concurrency limit; running test
    // files in parallel would make capacity behaviour non-deterministic.
    fileParallelism: false,
  },
});
