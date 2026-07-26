import { getTargetDefinition, type RunRequest, type RunResult } from "@qemu-playground/shared";
import { parseCompileOptions } from "./compile-options.js";
import type { ApiConfig } from "./config.js";
import { RunnerError, type Runner, type RunnerMeta, type RunnerOutcome } from "./runner/index.js";
import { signalNameFromStatus } from "./signals.js";

/**
 * Turns a validated request into a runner job, then interprets what came back
 * as one of the four protocol statuses (see
 * docs/internal/contracts/run-protocol.md).
 */

/** Names of the files the runner leaves behind, kept in one place. */
const SOURCE_NAMES = { c: "prog.c", asm: "prog.s" } as const;
const EXECUTABLE = "prog";
const ASSEMBLY_OUT = "out.s";

/**
 * `timeout` reports 124 when it had to terminate the command, or 137 when its
 * follow-up KILL was needed. Both statuses are also reachable by a program
 * choosing them itself, so an elapsed time at or beyond the limit is required
 * as well before a phase is called a timeout.
 */
const TIMEOUT_STATUSES = new Set([124, 137]);
/** Slack for clock granularity when comparing elapsed time to the limit. */
const TIMEOUT_ELAPSED_SLACK_MS = 100;

function phaseTimedOut(status: number | undefined, elapsedMs: number | undefined, limitMs: number): boolean {
  if (status === undefined || !TIMEOUT_STATUSES.has(status)) return false;
  if (elapsedMs === undefined) return true;
  return elapsedMs >= limitMs - TIMEOUT_ELAPSED_SLACK_MS;
}

interface Output {
  text: string;
  truncated: boolean;
}

/**
 * The runner truncates each file to `maxOutputBytes + 1`, so anything longer
 * than the cap here is known to have lost content.
 */
function readOutput(files: Map<string, Buffer>, name: string, maxBytes: number): Output {
  const raw = files.get(name) ?? Buffer.alloc(0);
  if (raw.length > maxBytes) {
    return { text: raw.subarray(0, maxBytes).toString("utf8"), truncated: true };
  }
  return { text: raw.toString("utf8"), truncated: false };
}

function buildJobArgv(request: RunRequest, options: readonly string[]) {
  const target = getTargetDefinition(request.target);
  const sourceName = SOURCE_NAMES[request.language];

  // asm input is linked without the C runtime, so a `_start` written by hand
  // is the entry point. C input keeps the default (crt + libc) link.
  const compileArgv =
    request.language === "asm"
      ? [target.gccCommand, "-nostdlib", ...options, "-o", EXECUTABLE, sourceName]
      : [target.gccCommand, ...options, "-o", EXECUTABLE, sourceName];

  // The same user options go to the -S build so the assembly shown matches the
  // code generation of the binary that actually ran.
  const assemblyArgv =
    request.language === "c"
      ? [target.gccCommand, ...options, "-S", "-o", ASSEMBLY_OUT, sourceName]
      : undefined;

  // Every target runs through QEMU with an explicit sysroot, including the one
  // that is native to the host, so the execution path never branches.
  const runArgv = [target.qemuBinary, "-L", target.qemuSysroot, `./${EXECUTABLE}`];

  return { sourceName, compileArgv, assemblyArgv, runArgv };
}

/** Best-effort phase attribution when the watchdog had to step in. */
function watchdogPhase(meta: RunnerMeta): "compile" | "run" {
  return meta.compileRc === 0 ? "run" : "compile";
}

export interface RunService {
  run(request: RunRequest): Promise<RunResult>;
}

export function createRunService(config: ApiConfig, runner: Runner): RunService {
  const maxBytes = config.maxOutputBytes;

  function toResult(request: RunRequest, outcome: RunnerOutcome): RunResult {
    const { meta, files } = outcome;
    const compileLog = readOutput(files, "compile.log", maxBytes);
    const compileFields = {
      compileLog: compileLog.text,
      compileLogTruncated: compileLog.truncated,
    };

    if (!meta.finished && outcome.watchdogFired) {
      // The in-container guards never completed. Report a timeout in the phase
      // that had been reached, rather than an internal error.
      return { status: "timeout", timeoutPhase: watchdogPhase(meta), ...compileFields };
    }

    if (meta.compileRc === undefined) {
      throw new RunnerError("Runner produced no compile result");
    }

    if (phaseTimedOut(meta.compileRc, meta.compileMs, config.compileTimeoutMs)) {
      return { status: "timeout", timeoutPhase: "compile", ...compileFields };
    }

    if (meta.compileRc !== 0) {
      return { status: "compile_error", ...compileFields };
    }

    // The exec build succeeded, so assembly "applies" to this Run for C input
    // even if the separate -S build failed, in which case it is reported empty
    // and the reason is already appended to the compile log by the runner.
    const assembly =
      request.language === "c"
        ? (() => {
            const generated = readOutput(files, ASSEMBLY_OUT, maxBytes);
            return { available: true as const, code: generated.text, truncated: generated.truncated };
          })()
        : { available: false as const };

    const stdout = readOutput(files, "stdout.txt", maxBytes);
    const stderr = readOutput(files, "stderr.txt", maxBytes);
    const outputFields = {
      stdout: stdout.text,
      stdoutTruncated: stdout.truncated,
      stderr: stderr.text,
      stderrTruncated: stderr.truncated,
    };

    if (meta.runRc === undefined) {
      throw new RunnerError("Runner produced no run result after a successful build");
    }

    if (phaseTimedOut(meta.runRc, meta.runMs, config.runTimeoutMs)) {
      return {
        status: "timeout",
        timeoutPhase: "run",
        ...compileFields,
        ...outputFields,
        assembly,
      };
    }

    const signal = signalNameFromStatus(meta.runRc);
    if (signal !== undefined) {
      return { status: "runtime_error", ...compileFields, ...outputFields, signal, assembly };
    }

    return { status: "success", ...compileFields, ...outputFields, exitCode: meta.runRc, assembly };
  }

  return {
    async run(request) {
      // Throws InvalidCompileOptionsError, which the route maps to HTTP 400.
      const options = parseCompileOptions(request.compileOptions);
      const { sourceName, compileArgv, assemblyArgv, runArgv } = buildJobArgv(request, options);

      const outcome = await runner.execute({
        source: { name: sourceName, contents: request.code },
        compileArgv,
        assemblyArgv,
        runArgv,
      });

      return toResult(request, outcome);
    },
  };
}
