import { readFileSync } from "node:fs";

/**
 * Source of `run.sh`, the fixed script that drives one Run inside the runner
 * container. See that file for what it produces. It is read once at startup
 * and injected into every runner container's /work.
 */
export const RUNNER_SCRIPT: string = readFileSync(new URL("./run.sh", import.meta.url), "utf8");
