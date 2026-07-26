import { RunResultSchema, type RunRequest } from "@qemu-playground/shared";
import { describe, expect, it } from "vitest";
import { loadConfig, type ApiConfig } from "../src/config.js";
import { createRunService } from "../src/run-service.js";
import type { Runner, RunnerJob, RunnerMeta, RunnerOutcome } from "../src/runner/index.js";
import { signalNameFromStatus } from "../src/signals.js";

/**
 * Result interpretation and argv construction, exercised against a stub runner
 * so the container-independent logic can be checked exactly.
 */

const config: ApiConfig = loadConfig({} as NodeJS.ProcessEnv);

function stubRunner(outcome: Partial<RunnerOutcome> & { meta: RunnerMeta }) {
  const jobs: RunnerJob[] = [];
  const runner: Runner = {
    async execute(job) {
      jobs.push(job);
      return { files: new Map(), watchdogFired: false, ...outcome };
    },
  };
  return { runner, jobs };
}

function filesOf(entries: Record<string, string>): Map<string, Buffer> {
  return new Map(Object.entries(entries).map(([name, text]) => [name, Buffer.from(text, "utf8")]));
}

const cRequest: RunRequest = { language: "c", target: "rv64", code: "int main(void){return 0;}" };

describe("argv construction", () => {
  it("builds separate exec and -S invocations for C, sharing the user options", async () => {
    const { runner, jobs } = stubRunner({ meta: { finished: true, compileRc: 0, runRc: 0 } });
    await createRunService(config, runner).run({ ...cRequest, compileOptions: "-O2 -Wall" });

    expect(jobs[0]?.source.name).toBe("prog.c");
    expect(jobs[0]?.compileArgv).toEqual([
      "riscv64-linux-gnu-gcc",
      "-O2",
      "-Wall",
      "-o",
      "prog",
      "prog.c",
    ]);
    expect(jobs[0]?.assemblyArgv).toEqual([
      "riscv64-linux-gnu-gcc",
      "-O2",
      "-Wall",
      "-S",
      "-o",
      "out.s",
      "prog.c",
    ]);
  });

  it("links asm input without the C runtime and asks for no assembly output", async () => {
    const { runner, jobs } = stubRunner({ meta: { finished: true, compileRc: 0, runRc: 0 } });
    await createRunService(config, runner).run({ language: "asm", target: "aarch64", code: "x" });

    expect(jobs[0]?.source.name).toBe("prog.s");
    expect(jobs[0]?.compileArgv).toEqual([
      "aarch64-linux-gnu-gcc",
      "-nostdlib",
      "-o",
      "prog",
      "prog.s",
    ]);
    expect(jobs[0]?.assemblyArgv).toBeUndefined();
  });

  it("always runs through QEMU with an explicit sysroot, including the native target", async () => {
    const { runner, jobs } = stubRunner({ meta: { finished: true, compileRc: 0, runRc: 0 } });
    const service = createRunService(config, runner);
    await service.run(cRequest);
    await service.run({ ...cRequest, target: "aarch64" });

    expect(jobs[0]?.runArgv).toEqual(["qemu-riscv64", "-L", "/usr/riscv64-linux-gnu", "./prog"]);
    expect(jobs[1]?.runArgv).toEqual(["qemu-aarch64", "-L", "/", "./prog"]);
  });
});

describe("result interpretation", () => {
  it("reports a non-zero exit as success", async () => {
    const { runner } = stubRunner({ meta: { finished: true, compileRc: 0, runRc: 3 } });
    const result = await createRunService(config, runner).run(cRequest);
    expect(result).toMatchObject({ status: "success", exitCode: 3 });
  });

  it("reports a signal death as runtime_error", async () => {
    const { runner } = stubRunner({ meta: { finished: true, compileRc: 0, runRc: 139 } });
    const result = await createRunService(config, runner).run(cRequest);
    expect(result).toMatchObject({ status: "runtime_error", signal: "SIGSEGV" });
  });

  it("keeps a failed build out of the run phase", async () => {
    const { runner } = stubRunner({
      meta: { finished: true, compileRc: 1 },
      files: filesOf({ "compile.log": "error: oops" }),
    });
    const result = await createRunService(config, runner).run(cRequest);
    expect(result).toEqual({
      status: "compile_error",
      compileLog: "error: oops",
      compileLogTruncated: false,
    });
  });

  it("distinguishes a compile timeout from a compile failure", async () => {
    const { runner } = stubRunner({
      meta: { finished: true, compileRc: 124, compileMs: config.compileTimeoutMs },
    });
    const result = await createRunService(config, runner).run(cRequest);
    expect(result).toMatchObject({ status: "timeout", timeoutPhase: "compile" });
    expect(result).not.toHaveProperty("stdout");
  });

  it("does not call a fast exit status 124 a timeout", async () => {
    const { runner } = stubRunner({
      meta: { finished: true, compileRc: 0, runRc: 124, runMs: 5 },
    });
    const result = await createRunService(config, runner).run(cRequest);
    expect(result).toMatchObject({ status: "success", exitCode: 124 });
  });

  it("keeps output and assembly for a run-phase timeout", async () => {
    const { runner } = stubRunner({
      meta: { finished: true, compileRc: 0, runRc: 124, runMs: config.runTimeoutMs + 20 },
      files: filesOf({ "stdout.txt": "partial", "out.s": "\tnop\n" }),
    });
    const result = await createRunService(config, runner).run(cRequest);
    expect(result).toMatchObject({
      status: "timeout",
      timeoutPhase: "run",
      stdout: "partial",
      assembly: { available: true, code: "\tnop\n", truncated: false },
    });
  });

  it("attributes a watchdog kill to the phase that had been reached", async () => {
    const compiled = stubRunner({ meta: { finished: false, compileRc: 0 }, watchdogFired: true });
    expect(await createRunService(config, compiled.runner).run(cRequest)).toMatchObject({
      status: "timeout",
      timeoutPhase: "run",
    });

    const stuck = stubRunner({ meta: { finished: false }, watchdogFired: true });
    expect(await createRunService(config, stuck.runner).run(cRequest)).toMatchObject({
      status: "timeout",
      timeoutPhase: "compile",
    });
  });

  it("still marks assembly available when only the -S build failed", async () => {
    const { runner } = stubRunner({
      meta: { finished: true, compileRc: 0, assemblyRc: 1, runRc: 0 },
      files: filesOf({ "compile.log": "[generated assembly unavailable: ...]" }),
    });
    const result = await createRunService(config, runner).run(cRequest);
    expect(result).toMatchObject({
      status: "success",
      assembly: { available: true, code: "", truncated: false },
    });
  });

  it("marks assembly unavailable for asm input", async () => {
    const { runner } = stubRunner({ meta: { finished: true, compileRc: 0, runRc: 0 } });
    const result = await createRunService(config, runner).run({
      language: "asm",
      target: "rv64",
      code: "x",
    });
    expect(result).toMatchObject({ assembly: { available: false } });
  });
});

describe("output truncation", () => {
  const capped: ApiConfig = { ...config, maxOutputBytes: 8 };

  it("flags outputs that exceeded the cap and keeps exactly the cap", async () => {
    const { runner } = stubRunner({
      meta: { finished: true, compileRc: 0, runRc: 0 },
      // The runner truncates to cap + 1 bytes, which is what arrives here.
      files: filesOf({
        "stdout.txt": "123456789",
        "stderr.txt": "12345678",
        "compile.log": "123456789",
        "out.s": "123456789",
      }),
    });
    const result = await createRunService(capped, runner).run(cRequest);

    expect(result).toMatchObject({
      stdout: "12345678",
      stdoutTruncated: true,
      // Exactly at the cap is not truncated.
      stderr: "12345678",
      stderrTruncated: false,
      compileLog: "12345678",
      compileLogTruncated: true,
      assembly: { available: true, code: "12345678", truncated: true },
    });
  });

  it("reports missing files as empty and untruncated", async () => {
    const { runner } = stubRunner({ meta: { finished: true, compileRc: 0, runRc: 0 } });
    const result = await createRunService(capped, runner).run(cRequest);
    expect(result).toMatchObject({ stdout: "", stdoutTruncated: false, compileLog: "" });
  });
});

describe("signalNameFromStatus", () => {
  it("decodes 128+n using Linux numbering, not the host's", () => {
    expect(signalNameFromStatus(139)).toBe("SIGSEGV");
    expect(signalNameFromStatus(134)).toBe("SIGABRT");
    // 10 is SIGUSR1 on Linux but SIGBUS on macOS.
    expect(signalNameFromStatus(138)).toBe("SIGUSR1");
  });

  it("leaves ordinary exit codes alone", () => {
    expect(signalNameFromStatus(0)).toBeUndefined();
    expect(signalNameFromStatus(42)).toBeUndefined();
    expect(signalNameFromStatus(128)).toBeUndefined();
    expect(signalNameFromStatus(200)).toBeUndefined();
  });
});

describe("schema conformance", () => {
  it("produces bodies that satisfy the shared result schema", async () => {
    const outcomes: RunnerOutcome[] = [
      { meta: { finished: true, compileRc: 0, runRc: 0 }, files: new Map(), watchdogFired: false },
      { meta: { finished: true, compileRc: 1 }, files: new Map(), watchdogFired: false },
      { meta: { finished: true, compileRc: 0, runRc: 139 }, files: new Map(), watchdogFired: false },
      {
        meta: { finished: true, compileRc: 124, compileMs: config.compileTimeoutMs },
        files: new Map(),
        watchdogFired: false,
      },
      {
        meta: { finished: true, compileRc: 0, runRc: 124, runMs: config.runTimeoutMs },
        files: new Map(),
        watchdogFired: false,
      },
    ];

    for (const outcome of outcomes) {
      const { runner } = stubRunner(outcome);
      const result = await createRunService(config, runner).run(cRequest);
      expect(RunResultSchema.safeParse(result).success).toBe(true);
    }
  });
});
