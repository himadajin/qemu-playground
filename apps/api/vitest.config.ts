import { configDefaults, defineConfig } from "vitest/config";

// test/integration.test.ts starts real runner containers, which needs a
// working Docker daemon and the qemu-playground-runner:dev image (see
// runner/Dockerfile). Environments without Docker or without that image
// built set this to skip the file entirely rather than trying to run it.
// Local development is unaffected: the variable is unset there, so the
// integration suite runs as before.
const skipIntegrationTests = process.env.API_SKIP_INTEGRATION_TESTS === "1";

export default defineConfig({
  // The shared package is a TypeScript-source workspace link, so it has to be
  // transformed by Vite instead of being externalized as a plain node module.
  ssr: { noExternal: ["@qemu-playground/shared"] },
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    exclude: skipIntegrationTests
      ? [...configDefaults.exclude, "test/integration.test.ts"]
      : configDefaults.exclude,
    // Integration tests start real runner containers (image pull/start plus
    // compilation under QEMU), which is far slower than the default budget.
    testTimeout: 180_000,
    hookTimeout: 180_000,
    // Runs are deliberately capped by a small concurrency limit; running test
    // files in parallel would make capacity behaviour non-deterministic.
    fileParallelism: false,
  },
});
