import { z } from "zod";
import { TargetIdSchema } from "./targets.js";

/**
 * Zod schemas for the `/run` protocol between apps/web and apps/api.
 *
 * This module is the single source of truth for the wire format described
 * in docs/internal/contracts/run-protocol.md. That document explains the
 * logical shape in prose; the exact field names, types, and optionality
 * here are what actually governs validation and the generated TypeScript
 * types.
 */

export const LanguageSchema = z.enum(["c", "asm"]);
export type Language = z.infer<typeof LanguageSchema>;

/**
 * Safe upper bound on submitted source size, in UTF-16 code units. Chosen
 * generously (64KB) since the target audience pastes short snippets, not
 * large programs.
 */
export const MAX_CODE_LENGTH = 64 * 1024;

// ---------------------------------------------------------------------------
// Request: POST /api/run
// ---------------------------------------------------------------------------

export const RunRequestSchema = z.strictObject({
  language: LanguageSchema,
  target: TargetIdSchema,
  code: z.string().min(1).max(MAX_CODE_LENGTH),
  /** Optional raw compiler flags. Absent or "" both mean "no extra flags". */
  compileOptions: z.string().optional(),
});
export type RunRequest = z.infer<typeof RunRequestSchema>;

// ---------------------------------------------------------------------------
// Result (HTTP 200 body): the outcome of a Run that was actually attempted.
//
// This is one of the two layers described in design.md's Direction section:
// "code that ran and produced an outcome" vs. "the Run could not be
// attempted at all" (see RunErrorResponseSchema below). Every status here
// is a normal, successful API call.
// ---------------------------------------------------------------------------

/**
 * How the generated assembly for a C compilation was (or wasn't) captured.
 * `available: false` means assembly does not apply to this Run at all (the
 * input language was asm, or the build never reached a point where an exec
 * binary existed). `available: true` always applies once the exec build
 * succeeded, even if the separate `-S` extraction itself failed: in that
 * case `code` is empty and `truncated` is false, and the failure is
 * described in the compile log instead (per execution.md).
 */
export const AssemblyResultSchema = z.discriminatedUnion("available", [
  z.strictObject({
    available: z.literal(true),
    code: z.string(),
    truncated: z.boolean(),
  }),
  z.strictObject({
    available: z.literal(false),
  }),
]);
export type AssemblyResult = z.infer<typeof AssemblyResultSchema>;

const compileLogFields = {
  compileLog: z.string(),
  compileLogTruncated: z.boolean(),
};

const outputFields = {
  stdout: z.string(),
  stdoutTruncated: z.boolean(),
  stderr: z.string(),
  stderrTruncated: z.boolean(),
};

/** Build succeeded and the program exited without being killed by a signal. */
export const RunSuccessResultSchema = z.strictObject({
  status: z.literal("success"),
  ...compileLogFields,
  ...outputFields,
  /** Process exit code. May be non-zero: a non-zero exit is still `success`. */
  exitCode: z.int(),
  assembly: AssemblyResultSchema,
});
export type RunSuccessResult = z.infer<typeof RunSuccessResultSchema>;

/** The build itself failed; execution never started. */
export const RunCompileErrorResultSchema = z.strictObject({
  status: z.literal("compile_error"),
  ...compileLogFields,
});
export type RunCompileErrorResult = z.infer<typeof RunCompileErrorResultSchema>;

/** Build succeeded, but the program was killed by a signal (e.g. SIGSEGV). */
export const RunRuntimeErrorResultSchema = z.strictObject({
  status: z.literal("runtime_error"),
  ...compileLogFields,
  ...outputFields,
  /** Symbolic signal name, e.g. "SIGSEGV". */
  signal: z.string(),
  assembly: AssemblyResultSchema,
});
export type RunRuntimeErrorResult = z.infer<typeof RunRuntimeErrorResultSchema>;

/**
 * The Run exceeded its time limit. `timeoutPhase` distinguishes a timeout
 * during compilation from one during execution under QEMU. `stdout`/
 * `stderr`/`assembly` are only present when the run phase was reached
 * (i.e. compilation had already succeeded), which in practice means
 * `timeoutPhase === "run"`.
 */
export const RunTimeoutResultSchema = z.strictObject({
  status: z.literal("timeout"),
  timeoutPhase: z.enum(["compile", "run"]),
  ...compileLogFields,
  stdout: z.string().optional(),
  stdoutTruncated: z.boolean().optional(),
  stderr: z.string().optional(),
  stderrTruncated: z.boolean().optional(),
  assembly: AssemblyResultSchema.optional(),
});
export type RunTimeoutResult = z.infer<typeof RunTimeoutResultSchema>;

export const RunResultSchema = z.discriminatedUnion("status", [
  RunSuccessResultSchema,
  RunCompileErrorResultSchema,
  RunRuntimeErrorResultSchema,
  RunTimeoutResultSchema,
]);
export type RunResult = z.infer<typeof RunResultSchema>;

// ---------------------------------------------------------------------------
// Error response (HTTP 400 / 429 / 500 body): the Run could not be
// attempted at all. Never mixed with RunResultSchema.
// ---------------------------------------------------------------------------

export const RunErrorCodeSchema = z.enum([
  /** Malformed request, e.g. unknown target, oversized code, missing field. HTTP 400. */
  "invalid_request",
  /** Concurrent Run limit was exceeded; the Run was rejected, not queued. HTTP 429. */
  "capacity_exceeded",
  /** Unexpected server-side failure (e.g. runner failed to start). HTTP 500. */
  "internal_error",
]);
export type RunErrorCode = z.infer<typeof RunErrorCodeSchema>;

export const RunErrorResponseSchema = z.strictObject({
  error: z.strictObject({
    code: RunErrorCodeSchema,
    message: z.string(),
  }),
});
export type RunErrorResponse = z.infer<typeof RunErrorResponseSchema>;
