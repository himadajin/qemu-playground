import { describe, expect, it } from "vitest";
import {
  MAX_CODE_LENGTH,
  RunErrorResponseSchema,
  RunRequestSchema,
  RunResultSchema,
} from "../src/protocol.js";

describe("RunRequestSchema", () => {
  it("accepts a minimal valid request without compileOptions", () => {
    const result = RunRequestSchema.safeParse({
      language: "c",
      target: "rv64",
      code: "int main(void) { return 0; }",
    });
    expect(result.success).toBe(true);
  });

  it("accepts an empty compileOptions string", () => {
    const result = RunRequestSchema.safeParse({
      language: "asm",
      target: "aarch64",
      code: "_start: ret",
      compileOptions: "",
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown target", () => {
    const result = RunRequestSchema.safeParse({
      language: "c",
      target: "riscv32",
      code: "int main(void) { return 0; }",
    });
    expect(result.success).toBe(false);
  });

  it("rejects an unknown language", () => {
    const result = RunRequestSchema.safeParse({
      language: "cpp",
      target: "rv64",
      code: "int main(void) { return 0; }",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty code", () => {
    const result = RunRequestSchema.safeParse({
      language: "c",
      target: "rv64",
      code: "",
    });
    expect(result.success).toBe(false);
  });

  it("rejects code longer than MAX_CODE_LENGTH", () => {
    const result = RunRequestSchema.safeParse({
      language: "c",
      target: "rv64",
      code: "a".repeat(MAX_CODE_LENGTH + 1),
    });
    expect(result.success).toBe(false);
  });
});

describe("RunResultSchema", () => {
  it("accepts a success result with a non-zero exit code and no assembly", () => {
    const result = RunResultSchema.safeParse({
      status: "success",
      compileLog: "",
      compileLogTruncated: false,
      stdout: "hi\n",
      stdoutTruncated: false,
      stderr: "",
      stderrTruncated: false,
      exitCode: 42,
      assembly: { available: false },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a success result carrying generated assembly for C input", () => {
    const result = RunResultSchema.safeParse({
      status: "success",
      compileLog: "",
      compileLogTruncated: false,
      stdout: "",
      stdoutTruncated: false,
      stderr: "",
      stderrTruncated: false,
      exitCode: 0,
      assembly: { available: true, code: "main:\n  ret\n", truncated: false },
    });
    expect(result.success).toBe(true);
  });

  it("accepts a compile_error result without stdout/stderr/exitCode", () => {
    const result = RunResultSchema.safeParse({
      status: "compile_error",
      compileLog: "error: expected ';'",
      compileLogTruncated: false,
    });
    expect(result.success).toBe(true);
  });

  it("rejects a compile_error result carrying an exit code", () => {
    const result = RunResultSchema.safeParse({
      status: "compile_error",
      compileLog: "error: expected ';'",
      compileLogTruncated: false,
      exitCode: 1,
    });
    expect(result.success).toBe(false);
  });

  it("distinguishes runtime_error (signal) from success (exit code)", () => {
    const result = RunResultSchema.safeParse({
      status: "runtime_error",
      compileLog: "",
      compileLogTruncated: false,
      stdout: "",
      stdoutTruncated: false,
      stderr: "",
      stderrTruncated: false,
      signal: "SIGSEGV",
      assembly: { available: false },
    });
    expect(result.success).toBe(true);
    if (result.success && result.data.status === "runtime_error") {
      expect(result.data.signal).toBe("SIGSEGV");
    }
  });

  it("accepts a compile-phase timeout without stdout/stderr", () => {
    const result = RunResultSchema.safeParse({
      status: "timeout",
      timeoutPhase: "compile",
      compileLog: "",
      compileLogTruncated: false,
    });
    expect(result.success).toBe(true);
  });

  it("accepts a run-phase timeout carrying partial stdout", () => {
    const result = RunResultSchema.safeParse({
      status: "timeout",
      timeoutPhase: "run",
      compileLog: "",
      compileLogTruncated: false,
      stdout: "partial output",
      stdoutTruncated: false,
      stderr: "",
      stderrTruncated: false,
      assembly: { available: false },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown status", () => {
    const result = RunResultSchema.safeParse({
      status: "cancelled",
      compileLog: "",
      compileLogTruncated: false,
    });
    expect(result.success).toBe(false);
  });
});

describe("RunErrorResponseSchema", () => {
  it("accepts a known error code with a message", () => {
    const result = RunErrorResponseSchema.safeParse({
      error: { code: "invalid_request", message: "unknown target" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects an unknown error code", () => {
    const result = RunErrorResponseSchema.safeParse({
      error: { code: "teapot", message: "oops" },
    });
    expect(result.success).toBe(false);
  });

  it("is a distinct shape from RunResultSchema (no status field)", () => {
    const errorLike = { error: { code: "internal_error", message: "boom" } };
    expect(RunResultSchema.safeParse(errorLike).success).toBe(false);
    expect(RunErrorResponseSchema.safeParse(errorLike).success).toBe(true);
  });
});
