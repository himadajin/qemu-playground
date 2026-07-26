import type { Language, RunResult } from "@qemu-playground/shared";

/**
 * Turns the two response layers of the run protocol into what the result pane
 * shows. Kept free of React so the mapping can be tested directly.
 *
 * Layer 1 — `RunResult` (HTTP 200): the Run happened; `status` says how it
 * ended. Layer 2 — `failed`: the Run itself could not be completed (HTTP
 * 400/429/500 or a transport failure), which the UI reports as `error` with
 * the reason printed in the Output log.
 */

export type RunPhase =
  | { kind: "idle" }
  | { kind: "running" }
  | { kind: "result"; result: RunResult }
  | { kind: "failed"; message: string };

export type StatusBadgeKind =
  "success" | "compile_error" | "runtime_error" | "timeout" | "running" | "error";

export const STATUS_BADGE_LABEL: Record<StatusBadgeKind, string> = {
  success: "success",
  compile_error: "compile error",
  runtime_error: "runtime error",
  timeout: "timeout",
  running: "running",
  error: "error",
};

export interface OutputView {
  /** One-line execution state, always present. */
  state: string;
  /** Exit code or terminating signal, when the program reached an end. */
  exit: string | null;
  /** `null` when execution never started, which is different from "empty". */
  stdout: string | null;
  stdoutTruncated: boolean;
  stderr: string | null;
  stderrTruncated: boolean;
  /** Extra log lines, e.g. why the Run could not be completed at all. */
  log: string[];
}

export interface BuildView {
  log: string;
  truncated: boolean;
  /** Placeholder shown instead of the log when there is nothing to read. */
  placeholder: string | null;
}

export type AssemblyView =
  { kind: "code"; code: string; truncated: boolean } | { kind: "empty"; message: string };

export interface ResultView {
  badge: StatusBadgeKind | null;
  output: OutputView;
  build: BuildView;
  assembly: AssemblyView;
}

const ASM_INPUT_MESSAGE =
  "Generated assembly applies to C input only. This Run compiled assembly source.";

function emptyOutput(state: string, log: string[] = []): OutputView {
  return {
    state,
    exit: null,
    stdout: null,
    stdoutTruncated: false,
    stderr: null,
    stderrTruncated: false,
    log,
  };
}

function assemblyFromResult(result: RunResult, language: Language): AssemblyView {
  if (language === "asm") {
    return { kind: "empty", message: ASM_INPUT_MESSAGE };
  }

  const assembly =
    result.status === "success" || result.status === "runtime_error" || result.status === "timeout"
      ? result.assembly
      : undefined;

  if (assembly === undefined || !assembly.available) {
    return {
      kind: "empty",
      message:
        "No assembly for this Run: the build did not reach a runnable binary. See the Build tab.",
    };
  }
  return { kind: "code", code: assembly.code, truncated: assembly.truncated };
}

function buildFromResult(result: RunResult): BuildView {
  return {
    log: result.compileLog,
    truncated: result.compileLogTruncated,
    placeholder: result.compileLog === "" ? "The build produced no output." : null,
  };
}

/** Derives everything the result pane renders for the current phase. */
export function deriveResultView(phase: RunPhase, language: Language): ResultView {
  const idleAssembly: AssemblyView =
    language === "asm"
      ? { kind: "empty", message: ASM_INPUT_MESSAGE }
      : {
          kind: "empty",
          message: "Run the code to see the generated assembly.",
        };

  if (phase.kind === "idle") {
    return {
      badge: null,
      output: emptyOutput("Not run yet."),
      build: { log: "", truncated: false, placeholder: "Not run yet." },
      assembly: idleAssembly,
    };
  }

  if (phase.kind === "running") {
    return {
      badge: "running",
      output: emptyOutput("Running…"),
      build: { log: "", truncated: false, placeholder: "Running…" },
      assembly: { kind: "empty", message: "Running…" },
    };
  }

  if (phase.kind === "failed") {
    return {
      badge: "error",
      output: emptyOutput("The Run could not be completed.", [phase.message]),
      build: {
        log: "",
        truncated: false,
        placeholder: "The Run could not be completed.",
      },
      assembly: idleAssembly,
    };
  }

  const { result } = phase;
  const build = buildFromResult(result);
  const assembly = assemblyFromResult(result, language);

  switch (result.status) {
    case "success":
      return {
        badge: "success",
        output: {
          state: "Program finished.",
          exit: `exit code ${result.exitCode}`,
          stdout: result.stdout,
          stdoutTruncated: result.stdoutTruncated,
          stderr: result.stderr,
          stderrTruncated: result.stderrTruncated,
          log: [],
        },
        build,
        assembly,
      };

    case "compile_error":
      return {
        badge: "compile_error",
        output: emptyOutput("The build failed; the program was not run.", [
          "See the Build tab for the compiler output.",
        ]),
        build,
        assembly,
      };

    case "runtime_error":
      return {
        badge: "runtime_error",
        output: {
          state: "Program terminated by a signal.",
          exit: `signal ${result.signal}`,
          stdout: result.stdout,
          stdoutTruncated: result.stdoutTruncated,
          stderr: result.stderr,
          stderrTruncated: result.stderrTruncated,
          log: [],
        },
        build,
        assembly,
      };

    case "timeout": {
      const reachedRun = result.timeoutPhase === "run";
      return {
        badge: "timeout",
        output: {
          state: reachedRun
            ? "Timed out while running."
            : "Timed out while compiling; the program was not run.",
          exit: null,
          stdout: result.stdout ?? null,
          stdoutTruncated: result.stdoutTruncated ?? false,
          stderr: result.stderr ?? null,
          stderrTruncated: result.stderrTruncated ?? false,
          log: [
            reachedRun
              ? "The time limit was reached during execution."
              : "The time limit was reached during compilation.",
          ],
        },
        build,
        assembly,
      };
    }
  }
}
