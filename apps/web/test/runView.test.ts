import type { RunResult } from "@qemu-playground/shared";
import { describe, expect, it } from "vitest";
import { deriveResultView } from "../src/lib/runView";

const SUCCESS: RunResult = {
  status: "success",
  compileLog: "",
  compileLogTruncated: false,
  stdout: "hello\n",
  stdoutTruncated: false,
  stderr: "",
  stderrTruncated: false,
  exitCode: 42,
  assembly: { available: true, code: "  li a0, 42\n", truncated: false },
};

describe("result view mapping", () => {
  it("shows nothing but a placeholder before the first Run", () => {
    const view = deriveResultView({ kind: "idle" }, "c");
    expect(view.badge).toBeNull();
    expect(view.output.stdout).toBeNull();
    expect(view.assembly.kind).toBe("empty");
  });

  it("marks a Run in flight as running with no leftover output", () => {
    const view = deriveResultView({ kind: "running" }, "c");
    expect(view.badge).toBe("running");
    expect(view.output.stdout).toBeNull();
    expect(view.build.log).toBe("");
  });

  it("treats a non-zero exit code as success", () => {
    const view = deriveResultView({ kind: "result", result: SUCCESS }, "c");
    expect(view.badge).toBe("success");
    expect(view.output.exit).toContain("42");
    expect(view.output.stdout).toBe("hello\n");
  });

  it("exposes the generated assembly for C input", () => {
    const view = deriveResultView({ kind: "result", result: SUCCESS }, "c");
    expect(view.assembly).toEqual({
      kind: "code",
      code: "  li a0, 42\n",
      truncated: false,
    });
  });

  it("never shows assembly for assembly input", () => {
    const view = deriveResultView({ kind: "result", result: SUCCESS }, "asm");
    expect(view.assembly.kind).toBe("empty");
  });

  it("carries truncation flags through to the view", () => {
    const result: RunResult = {
      ...SUCCESS,
      stdoutTruncated: true,
      compileLog: "warning: ...",
      compileLogTruncated: true,
      assembly: { available: true, code: "...", truncated: true },
    };
    const view = deriveResultView({ kind: "result", result }, "c");
    expect(view.output.stdoutTruncated).toBe(true);
    expect(view.build.truncated).toBe(true);
    expect(view.assembly).toMatchObject({ truncated: true });
  });

  it("reports a compile error with no execution output at all", () => {
    const result: RunResult = {
      status: "compile_error",
      compileLog: "main.c:1: error",
      compileLogTruncated: false,
    };
    const view = deriveResultView({ kind: "result", result }, "c");
    expect(view.badge).toBe("compile_error");
    expect(view.output.stdout).toBeNull();
    expect(view.output.stderr).toBeNull();
    expect(view.build.log).toBe("main.c:1: error");
    expect(view.assembly.kind).toBe("empty");
  });

  it("reports a signal as a runtime error", () => {
    const result: RunResult = {
      status: "runtime_error",
      compileLog: "",
      compileLogTruncated: false,
      stdout: "",
      stdoutTruncated: false,
      stderr: "",
      stderrTruncated: false,
      signal: "SIGSEGV",
      assembly: { available: false },
    };
    const view = deriveResultView({ kind: "result", result }, "c");
    expect(view.badge).toBe("runtime_error");
    expect(view.output.exit).toContain("SIGSEGV");
    expect(view.output.stdout).toBe("");
  });

  it("distinguishes the two timeout phases", () => {
    const compilePhase: RunResult = {
      status: "timeout",
      timeoutPhase: "compile",
      compileLog: "",
      compileLogTruncated: false,
    };
    const runPhase: RunResult = {
      status: "timeout",
      timeoutPhase: "run",
      compileLog: "",
      compileLogTruncated: false,
      stdout: "partial",
      stdoutTruncated: false,
      stderr: "",
      stderrTruncated: false,
      assembly: { available: true, code: "x", truncated: false },
    };

    const compileView = deriveResultView({ kind: "result", result: compilePhase }, "c");
    expect(compileView.badge).toBe("timeout");
    expect(compileView.output.state).toMatch(/compil/i);
    expect(compileView.output.stdout).toBeNull();

    const runView = deriveResultView({ kind: "result", result: runPhase }, "c");
    expect(runView.output.state).toMatch(/running/i);
    expect(runView.output.stdout).toBe("partial");
    expect(runView.assembly.kind).toBe("code");
  });

  it("puts a Run that never happened in the error badge with its reason", () => {
    const view = deriveResultView(
      { kind: "failed", message: "capacity_exceeded: too many runs" },
      "c",
    );
    expect(view.badge).toBe("error");
    expect(view.output.log).toContain("capacity_exceeded: too many runs");
    expect(view.output.stdout).toBeNull();
  });
});
