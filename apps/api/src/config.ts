/**
 * Runtime configuration, read from the environment.
 *
 * Every knob has a default that is sensible for the small self-hosted
 * deployment described in docs/internal/specs/run-execution.md, so
 * the server starts with no environment set at all. The README documents the
 * same list.
 */

export interface ApiConfig {
  /** Address the HTTP server binds to. */
  host: string;
  /** Port the HTTP server binds to. */
  port: number;
  /** Image used for the short-lived per-Run runner container. */
  runnerImage: string;
  /** Docker socket used to start sibling containers. */
  dockerSocketPath: string;
  /** Number of Runs allowed to execute at the same time. Excess is rejected, never queued. */
  maxConcurrentRuns: number;
  /** Time limit for the compile phase inside the runner. */
  compileTimeoutMs: number;
  /** Time limit for the QEMU execution phase inside the runner. */
  runTimeoutMs: number;
  /**
   * Slack added on top of the in-container time limits before the API-side
   * watchdog force-removes a container. This is a backstop for a runner that
   * hangs in a way `timeout` cannot catch, not the normal timeout path.
   */
  watchdogExtraMs: number;
  /** CPU quota for the runner container, in whole CPUs (fractions allowed). */
  runnerCpus: number;
  /** Memory limit for the runner container, in MiB. */
  runnerMemoryMb: number;
  /** Process limit for the runner container. */
  runnerPidsLimit: number;
  /** Byte cap applied to compileLog, stdout, stderr and generated assembly. */
  maxOutputBytes: number;
}

function readString(env: NodeJS.ProcessEnv, name: string, fallback: string): string {
  const raw = env[name];
  return raw === undefined || raw === "" ? fallback : raw;
}

function readNumber(
  env: NodeJS.ProcessEnv,
  name: string,
  fallback: number,
  { min, integer }: { min: number; integer: boolean },
): number {
  const raw = env[name];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) {
    throw new Error(
      `Invalid value for ${name}: ${JSON.stringify(raw)} (expected ${
        integer ? "an integer" : "a number"
      } >= ${min})`,
    );
  }
  return value;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): ApiConfig {
  return {
    host: readString(env, "HOST", "0.0.0.0"),
    port: readNumber(env, "PORT", 8080, { min: 1, integer: true }),
    runnerImage: readString(env, "RUNNER_IMAGE", "qemu-playground-runner:dev"),
    dockerSocketPath: readString(env, "DOCKER_SOCKET_PATH", "/var/run/docker.sock"),
    maxConcurrentRuns: readNumber(env, "MAX_CONCURRENT_RUNS", 2, { min: 1, integer: true }),
    compileTimeoutMs: readNumber(env, "COMPILE_TIMEOUT_MS", 10_000, { min: 1, integer: true }),
    runTimeoutMs: readNumber(env, "RUN_TIMEOUT_MS", 5_000, { min: 1, integer: true }),
    watchdogExtraMs: readNumber(env, "WATCHDOG_EXTRA_MS", 15_000, { min: 0, integer: true }),
    runnerCpus: readNumber(env, "RUNNER_CPUS", 1, { min: 0.01, integer: false }),
    runnerMemoryMb: readNumber(env, "RUNNER_MEMORY_MB", 256, { min: 16, integer: true }),
    runnerPidsLimit: readNumber(env, "RUNNER_PIDS_LIMIT", 64, { min: 1, integer: true }),
    maxOutputBytes: readNumber(env, "MAX_OUTPUT_BYTES", 64 * 1024, { min: 1, integer: true }),
  };
}
