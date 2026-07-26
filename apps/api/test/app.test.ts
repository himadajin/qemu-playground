import { MAX_CODE_LENGTH, RunErrorResponseSchema } from "@qemu-playground/shared";
import { afterEach, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig, type ApiConfig } from "../src/config.js";
import { RunnerError, type Runner, type RunnerOutcome } from "../src/runner/index.js";

/**
 * HTTP-level behaviour of the two error layers, driven by stub runners so the
 * routing rules are checked without Docker in the way.
 */

const baseConfig: ApiConfig = loadConfig({} as NodeJS.ProcessEnv);

const okOutcome: RunnerOutcome = {
  meta: { finished: true, compileRc: 0, runRc: 0 },
  files: new Map(),
  watchdogFired: false,
};

const validBody = { language: "c", target: "rv64", code: "int main(void){return 0;}" };

let apps: ReturnType<typeof createApp>[] = [];

function makeApp(runner: Runner, config: ApiConfig = baseConfig) {
  const app = createApp({ config, runner, logger: false });
  apps.push(app);
  return app;
}

afterEach(async () => {
  await Promise.all(apps.map((app) => app.close()));
  apps = [];
});

describe("POST /api/run request validation", () => {
  const app = () => makeApp({ execute: async () => okOutcome });

  it.each([
    ["unknown target", { ...validBody, target: "x86_64" }],
    ["unknown language", { ...validBody, language: "cpp" }],
    ["missing code", { language: "c", target: "rv64" }],
    ["empty code", { ...validBody, code: "" }],
    ["oversized code", { ...validBody, code: "a".repeat(MAX_CODE_LENGTH + 1) }],
    ["unknown field", { ...validBody, extra: true }],
    ["non-object body", "not json at all"],
  ])("rejects %s with 400 invalid_request", async (_name, payload) => {
    const response = await app().inject({ method: "POST", url: "/api/run", payload });
    expect(response.statusCode).toBe(400);
    const body = RunErrorResponseSchema.parse(response.json());
    expect(body.error.code).toBe("invalid_request");
  });

  it("rejects disallowed compile options with 400 and names the token", async () => {
    const response = await app().inject({
      method: "POST",
      url: "/api/run",
      payload: { ...validBody, compileOptions: "-O2 -o /tmp/evil" },
    });
    expect(response.statusCode).toBe(400);
    const body = RunErrorResponseSchema.parse(response.json());
    expect(body.error.code).toBe("invalid_request");
    expect(body.error.message).toContain('"-o"');
  });

  it("accepts a request with no compileOptions at all", async () => {
    const response = await app().inject({ method: "POST", url: "/api/run", payload: validBody });
    expect(response.statusCode).toBe(200);
  });
});

describe("concurrency limit", () => {
  it("rejects excess runs immediately with 429 instead of queueing them", async () => {
    let release!: () => void;
    const blocked = new Promise<void>((resolve) => {
      release = resolve;
    });
    const app = makeApp(
      {
        async execute() {
          await blocked;
          return okOutcome;
        },
      },
      { ...baseConfig, maxConcurrentRuns: 2 },
    );

    const inFlight = [
      app.inject({ method: "POST", url: "/api/run", payload: validBody }),
      app.inject({ method: "POST", url: "/api/run", payload: validBody }),
    ];
    // Let both handlers reach the runner before probing the third.
    await new Promise((resolve) => setImmediate(resolve));

    const rejected = await app.inject({ method: "POST", url: "/api/run", payload: validBody });
    expect(rejected.statusCode).toBe(429);
    expect(RunErrorResponseSchema.parse(rejected.json()).error.code).toBe("capacity_exceeded");

    release();
    for (const response of await Promise.all(inFlight)) {
      expect(response.statusCode).toBe(200);
    }

    // The slots are handed back, so a later run is accepted again.
    const afterwards = await app.inject({ method: "POST", url: "/api/run", payload: validBody });
    expect(afterwards.statusCode).toBe(200);
  });
});

describe("runner failures", () => {
  it("maps a runner failure to 500 internal_error", async () => {
    const app = makeApp({
      execute: async () => {
        throw new RunnerError("Failed to create runner container from image missing:tag");
      },
    });
    const response = await app.inject({ method: "POST", url: "/api/run", payload: validBody });
    expect(response.statusCode).toBe(500);
    expect(RunErrorResponseSchema.parse(response.json()).error.code).toBe("internal_error");
  });

  it("maps an unexpected failure to 500 without leaking its detail", async () => {
    const app = makeApp({
      execute: async () => {
        throw new Error("ENOENT /var/run/docker.sock");
      },
    });
    const response = await app.inject({ method: "POST", url: "/api/run", payload: validBody });
    expect(response.statusCode).toBe(500);
    const body = RunErrorResponseSchema.parse(response.json());
    expect(body.error.code).toBe("internal_error");
    expect(body.error.message).not.toContain("docker.sock");
  });

  it("releases the concurrency slot when a run fails", async () => {
    let calls = 0;
    const app = makeApp(
      {
        execute: async () => {
          calls += 1;
          if (calls === 1) throw new RunnerError("boom");
          return okOutcome;
        },
      },
      { ...baseConfig, maxConcurrentRuns: 1 },
    );

    expect((await app.inject({ method: "POST", url: "/api/run", payload: validBody })).statusCode).toBe(500);
    expect((await app.inject({ method: "POST", url: "/api/run", payload: validBody })).statusCode).toBe(200);
  });
});

describe("other routes", () => {
  it("answers the health check", async () => {
    const response = await makeApp({ execute: async () => okOutcome }).inject({
      method: "GET",
      url: "/api/healthz",
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "ok" });
  });

  it("returns the protocol's error shape for unknown routes", async () => {
    const response = await makeApp({ execute: async () => okOutcome }).inject({
      method: "GET",
      url: "/api/nope",
    });
    expect(response.statusCode).toBe(400);
    expect(RunErrorResponseSchema.parse(response.json()).error.code).toBe("invalid_request");
  });
});
