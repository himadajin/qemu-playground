import { randomUUID } from "node:crypto";
import Docker from "dockerode";
import type { ApiConfig } from "../config.js";
import { extractFiles, packFiles, type ArchiveFile } from "./archive.js";
import { RUNNER_SCRIPT } from "./script.js";

/** Raised when the Run could not be carried out at all; maps to HTTP 500. */
export class RunnerError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "RunnerError";
  }
}

export interface RunnerJob {
  /** Source file to place in /work, e.g. "prog.c" with the user's code. */
  source: ArchiveFile;
  /** argv of the build that produces the executable `prog`. */
  compileArgv: readonly string[];
  /** argv of the `-S` build that produces `out.s`; omitted for asm input. */
  assemblyArgv?: readonly string[];
  /** argv of the QEMU invocation. */
  runArgv: readonly string[];
}

/** Raw per-phase facts recovered from the container, before interpretation. */
export interface RunnerOutcome {
  /** Parsed `meta.txt`. Missing keys mean the phase was never reached. */
  meta: RunnerMeta;
  /** Collected files, capped at `maxOutputBytes + 1` bytes each. */
  files: Map<string, Buffer>;
  /**
   * True when the API-side watchdog had to force-stop the container, i.e. the
   * in-container `timeout` guards did not bring things to an end on their own.
   */
  watchdogFired: boolean;
}

export interface RunnerMeta {
  compileRc?: number;
  compileMs?: number;
  assemblyRc?: number;
  runRc?: number;
  runMs?: number;
  finished: boolean;
}

export interface Runner {
  execute(job: RunnerJob): Promise<RunnerOutcome>;
}

const COLLECTED_FILES = ["compile.log", "stdout.txt", "stderr.txt", "out.s", "meta.txt"] as const;

/** Serialises an argv array the way `mapfile -t -d ''` reads it back in bash. */
function packArgv(argv: readonly string[]): Buffer {
  return Buffer.from(argv.map((arg) => `${arg}\0`).join(""), "utf8");
}

function parseMeta(raw: Buffer | undefined): RunnerMeta {
  const meta: RunnerMeta = { finished: false };
  if (!raw) return meta;

  for (const line of raw.toString("utf8").split("\n")) {
    const separator = line.indexOf("=");
    if (separator < 0) continue;
    const key = line.slice(0, separator);
    const value = line.slice(separator + 1);
    switch (key) {
      case "compile_rc":
        meta.compileRc = Number(value);
        break;
      case "compile_ms":
        meta.compileMs = Number(value);
        break;
      case "asm_rc":
        meta.assemblyRc = Number(value);
        break;
      case "run_rc":
        meta.runRc = Number(value);
        break;
      case "run_ms":
        meta.runMs = Number(value);
        break;
      case "finished":
        meta.finished = value === "1";
        break;
      default:
        break;
    }
  }
  return meta;
}

/**
 * Runs each Run in its own short-lived sibling container.
 *
 * The container is created stopped, the sources and the driver script are
 * injected with `putArchive`, and only then is it started; results come back
 * with `getArchive`. Nothing is bind-mounted, so this works unchanged whether
 * the API runs directly on a developer's machine or inside a container that
 * only has the Docker socket.
 */
export function createDockerRunner(config: ApiConfig): Runner {
  const docker = new Docker({ socketPath: config.dockerSocketPath });

  const compileTimeoutS = (config.compileTimeoutMs / 1000).toFixed(3);
  const runTimeoutS = (config.runTimeoutMs / 1000).toFixed(3);
  // The compile guard can fire twice (exec build and -S build) before the run
  // guard even starts, so the backstop has to cover both plus container start.
  const watchdogMs = config.compileTimeoutMs * 2 + config.runTimeoutMs + config.watchdogExtraMs;

  async function execute(job: RunnerJob): Promise<RunnerOutcome> {
    const files: ArchiveFile[] = [
      { name: "run.sh", contents: RUNNER_SCRIPT, mode: 0o755 },
      job.source,
      { name: "compile.argv", contents: packArgv(job.compileArgv) },
      { name: "run.argv", contents: packArgv(job.runArgv) },
    ];
    if (job.assemblyArgv) {
      files.push({ name: "asm.argv", contents: packArgv(job.assemblyArgv) });
    }

    let container: Docker.Container;
    try {
      container = await docker.createContainer({
        name: `qemu-playground-run-${randomUUID()}`,
        Image: config.runnerImage,
        Cmd: ["bash", "/work/run.sh"],
        WorkingDir: "/work",
        User: "1000:1000",
        Env: [
          `COMPILE_TIMEOUT_S=${compileTimeoutS}`,
          `RUN_TIMEOUT_S=${runTimeoutS}`,
          `MAX_OUTPUT_BYTES=${config.maxOutputBytes}`,
        ],
        Tty: false,
        OpenStdin: false,
        NetworkDisabled: true,
        Labels: { "com.qemu-playground.role": "runner" },
        HostConfig: {
          NetworkMode: "none",
          AutoRemove: false,
          Memory: config.runnerMemoryMb * 1024 * 1024,
          MemorySwap: config.runnerMemoryMb * 1024 * 1024,
          NanoCpus: Math.round(config.runnerCpus * 1e9),
          PidsLimit: config.runnerPidsLimit,
          CapDrop: ["ALL"],
          SecurityOpt: ["no-new-privileges"],
        },
      });
    } catch (cause) {
      throw new RunnerError(`Failed to create runner container from image ${config.runnerImage}`, {
        cause,
      });
    }

    let watchdogFired = false;
    let watchdog: NodeJS.Timeout | undefined;
    try {
      await container.putArchive(packFiles(files), { path: "/work" });
      await container.start();

      watchdog = setTimeout(() => {
        watchdogFired = true;
        void container.kill().catch(() => {
          /* already gone */
        });
      }, watchdogMs);

      await container.wait();
      clearTimeout(watchdog);
      watchdog = undefined;

      const archive = await container.getArchive({ path: "/work" });
      const collected = await extractFiles(archive, COLLECTED_FILES, config.maxOutputBytes + 1);

      return { meta: parseMeta(collected.get("meta.txt")), files: collected, watchdogFired };
    } catch (cause) {
      if (watchdogFired) {
        // The container was killed from under the wait/collect calls; report
        // it as an unfinished Run rather than an internal failure.
        return { meta: { finished: false }, files: new Map(), watchdogFired };
      }
      throw new RunnerError("Runner container failed", { cause });
    } finally {
      if (watchdog) clearTimeout(watchdog);
      await container.remove({ force: true, v: true }).catch(() => {
        /* best effort: nothing else can be done about a stuck container here */
      });
    }
  }

  return { execute };
}
