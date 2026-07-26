import {
  TARGETS,
  RunErrorResponseSchema,
  RunResultSchema,
  type TargetId,
} from "@qemu-playground/shared";
import type { FastifyInstance } from "fastify";
import type { InjectOptions } from "light-my-request";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createApp } from "../src/app.js";
import { loadConfig, type ApiConfig } from "../src/config.js";
import {
  ASM_EXIT_42,
  C_CHATTY,
  C_COMPILE_ERROR,
  C_EXIT_42,
  C_HELLO,
  C_INFINITE_LOOP,
  C_SEGFAULT,
} from "./samples.js";

/**
 * End-to-end tests against real runner containers.
 *
 * They need the runner image to exist:
 *   docker build -t qemu-playground-runner:dev runner/
 *
 * Every response is parsed with the shared schemas, so these also assert that
 * what the API actually puts on the wire matches the contract.
 */

const targetIds = TARGETS.map((target) => target.id);

const defaults = loadConfig({} as NodeJS.ProcessEnv);

const apps: FastifyInstance[] = [];

function appWith(overrides: Partial<ApiConfig> = {}): FastifyInstance {
  const app = createApp({ config: { ...defaults, ...overrides }, logger: false });
  apps.push(app);
  return app;
}

/** Posts a Run and asserts the body matches whichever protocol schema applies. */
async function run(app: FastifyInstance, payload: InjectOptions["payload"]) {
  const response = await app.inject({ method: "POST", url: "/api/run", payload });
  const body: unknown = response.json();
  if (response.statusCode === 200) {
    return { statusCode: response.statusCode, result: RunResultSchema.parse(body) };
  }
  return { statusCode: response.statusCode, error: RunErrorResponseSchema.parse(body) };
}

let shared: FastifyInstance;

beforeAll(() => {
  shared = appWith();
});

afterAll(async () => {
  await Promise.all(apps.map((app) => app.close()));
});

describe.each(targetIds)("target %s", (target: TargetId) => {
  it("compiles and runs C, returning output and generated assembly", async () => {
    const { statusCode, result } = await run(shared, { language: "c", target, code: C_HELLO });

    expect(statusCode).toBe(200);
    expect(result).toMatchObject({
      status: "success",
      exitCode: 0,
      stdout: "hello from C\n",
      stderr: "on stderr\n",
      stdoutTruncated: false,
      stderrTruncated: false,
    });
    expect(result?.status === "success" && result.assembly.available).toBe(true);
    if (result?.status === "success" && result.assembly.available) {
      expect(result.assembly.code.length).toBeGreaterThan(0);
      expect(result.assembly.code).toContain("main");
    }
  });

  it("builds and runs hand-written asm with a _start entry point", async () => {
    const { statusCode, result } = await run(shared, {
      language: "asm",
      target,
      code: ASM_EXIT_42[target],
    });

    expect(statusCode).toBe(200);
    expect(result).toMatchObject({
      status: "success",
      exitCode: 42,
      stdout: "hello\n",
      assembly: { available: false },
    });
  });
});

describe("execution outcomes", () => {
  it("treats a non-zero exit as success", async () => {
    const { result } = await run(shared, { language: "c", target: "rv64", code: C_EXIT_42 });
    expect(result).toMatchObject({ status: "success", exitCode: 42 });
  });

  it("reports a segmentation fault as runtime_error with the signal name", async () => {
    const { result } = await run(shared, { language: "c", target: "rv64", code: C_SEGFAULT });
    expect(result).toMatchObject({
      status: "runtime_error",
      signal: "SIGSEGV",
      // Output written before the fault is still collected.
      stdout: "about to fault\n",
    });
    // The build succeeded, so assembly still applies.
    expect(result?.status === "runtime_error" && result.assembly.available).toBe(true);
  });

  it("reports a build failure as compile_error with the compiler's message", async () => {
    const { statusCode, result } = await run(shared, {
      language: "c",
      target: "rv64",
      code: C_COMPILE_ERROR,
    });

    expect(statusCode).toBe(200);
    expect(result?.status).toBe("compile_error");
    expect(result?.status === "compile_error" && result.compileLog).toContain("nosuchsymbol");
    // compile_error never carries execution fields.
    expect(result).not.toHaveProperty("stdout");
    expect(result).not.toHaveProperty("assembly");
  });

  it("reports a hanging program as a run-phase timeout", async () => {
    const app = appWith({ runTimeoutMs: 1500 });
    const { statusCode, result } = await run(app, {
      language: "c",
      target: "rv64",
      code: C_INFINITE_LOOP,
    });

    expect(statusCode).toBe(200);
    expect(result).toMatchObject({ status: "timeout", timeoutPhase: "run" });
  });

  it("reports a slow build as a compile-phase timeout", async () => {
    const app = appWith({ compileTimeoutMs: 1 });
    const { statusCode, result } = await run(app, { language: "c", target: "rv64", code: C_HELLO });

    expect(statusCode).toBe(200);
    expect(result).toMatchObject({ status: "timeout", timeoutPhase: "compile" });
    // Nothing reached the run phase, so there is no output and no assembly.
    expect(result).not.toHaveProperty("stdout");
    expect(result).not.toHaveProperty("assembly");
  });
});

describe("compile options", () => {
  it("applies accepted options to both the exec build and the generated assembly", async () => {
    const { result } = await run(shared, {
      language: "c",
      target: "rv64",
      code: C_HELLO,
      compileOptions: "-O2 -Wall -DEXTRA=1",
    });

    expect(result).toMatchObject({ status: "success", exitCode: 0 });
    if (result?.status === "success" && result.assembly.available) {
      // -O2 inlines printf("...\n") into puts, which -O0 output does not show.
      expect(result.assembly.code).toContain("puts");
    }
  });

  it("rejects options outside the allowlist with 400 before starting a container", async () => {
    const { statusCode, error } = await run(shared, {
      language: "c",
      target: "rv64",
      code: C_HELLO,
      compileOptions: "-Wl,-rpath,/tmp",
    });

    expect(statusCode).toBe(400);
    expect(error?.error.code).toBe("invalid_request");
    expect(error?.error.message).toContain("-Wl,-rpath,/tmp");
  });
});

describe("output limits", () => {
  it("caps a chatty program's output in the container and flags the truncation", async () => {
    const app = appWith({ maxOutputBytes: 4096 });
    const { statusCode, result } = await run(app, {
      language: "c",
      target: "rv64",
      code: C_CHATTY,
    });

    expect(statusCode).toBe(200);
    expect(result).toMatchObject({
      status: "success",
      exitCode: 0,
      stdoutTruncated: true,
      stderrTruncated: true,
    });
    if (result?.status === "success") {
      expect(Buffer.byteLength(result.stdout, "utf8")).toBe(4096);
      expect(Buffer.byteLength(result.stderr, "utf8")).toBe(4096);
    }
  });
});

describe("capacity", () => {
  it("rejects runs beyond the concurrency limit with 429 rather than queueing", async () => {
    const app = appWith({ maxConcurrentRuns: 2 });
    const payload = { language: "c", target: "rv64", code: C_HELLO };

    const [first, second, third] = await Promise.all([
      run(app, payload),
      run(app, payload),
      run(app, payload),
    ]);

    expect(first.statusCode).toBe(200);
    expect(second.statusCode).toBe(200);
    expect(third.statusCode).toBe(429);
    expect(third.error?.error.code).toBe("capacity_exceeded");
  });
});

describe("failure to start a Run", () => {
  it("reports a missing runner image as 500 internal_error", async () => {
    const app = appWith({ runnerImage: "qemu-playground-runner:no-such-tag-9d3f" });
    const { statusCode, error } = await run(app, {
      language: "c",
      target: "rv64",
      code: C_HELLO,
    });

    expect(statusCode).toBe(500);
    expect(error?.error.code).toBe("internal_error");
  });
});

describe("cleanup", () => {
  it("leaves no runner containers behind", async () => {
    const { execFile } = await import("node:child_process");
    const { promisify } = await import("node:util");
    const { stdout } = await promisify(execFile)("docker", [
      "ps",
      "-a",
      "--filter",
      "label=com.qemu-playground.role=runner",
      "--format",
      "{{.Names}}",
    ]);
    expect(stdout.trim()).toBe("");
  });
});
