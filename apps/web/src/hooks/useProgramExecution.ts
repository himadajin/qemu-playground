import { useRef, useState } from "react";
import type { ProgramFile } from "../lib/files";
import type { ShareState } from "../lib/share";
import { requestRun } from "../lib/runApi";
import type { RunPhase } from "../lib/runView";
import type { ConsolePosition } from "./useConsoleScroll";

export const RUN_HISTORY_LIMIT = 20;
export interface RunRecord {
  readonly id: string;
  readonly sequence: number;
  readonly startedAt: number;
  readonly fileName: string;
  readonly input: Readonly<ShareState>;
  phase: Exclude<RunPhase, { kind: "idle" }>;
  collapsed: boolean;
}
export interface Execution {
  runs: RunRecord[];
  nextSequence: number;
}
export function useProgramExecution() {
  const [executions, setExecutions] = useState<Record<string, Execution>>({});
  const [scrollPositions] = useState(() => new Map<string, ConsolePosition>());
  const [runningId, setRunningId] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);

  async function execute(file: ProgramFile) {
    const id = crypto.randomUUID();
    const startedAt = Date.now();
    const input: ShareState = {
      language: file.language,
      target: file.target,
      code: file.code,
      compileOptions: file.compileOptions,
    };
    const fileName = file.name;
    setRunningId(file.id);
    setExecutions((current) => {
      const previous = current[file.id];
      const sequence = previous?.nextSequence ?? 1;
      const record: RunRecord = {
        id,
        sequence,
        startedAt,
        fileName,
        input,
        phase: { kind: "running" },
        collapsed: false,
      };
      return {
        ...current,
        [file.id]: {
          runs: [...(previous?.runs ?? []), record].slice(-RUN_HISTORY_LIMIT),
          nextSequence: sequence + 1,
        },
      };
    });
    function complete(phase: RunRecord["phase"]) {
      setExecutions((current) => {
        const previous = current[file.id];
        if (!previous) return current;
        return {
          ...current,
          [file.id]: {
            ...previous,
            runs: previous.runs.map((run) => (run.id === id ? { ...run, phase } : run)),
          },
        };
      });
    }
    try {
      const outcome = await requestRun(input);
      complete(
        outcome.ok
          ? { kind: "result", result: outcome.result }
          : { kind: "failed", message: outcome.message },
      );
    } catch {
      complete({ kind: "failed", message: "The Run could not be completed. Try again." });
    } finally {
      inFlight.current = null;
      setRunningId(null);
    }
  }
  function run(file: ProgramFile): boolean {
    if (inFlight.current) return false;
    inFlight.current = file.id;
    void execute(file);
    return true;
  }
  function isRunning(id: string) {
    return inFlight.current === id;
  }
  function forget(id: string) {
    if (isRunning(id)) return;
    scrollPositions.delete(id);
    setExecutions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  function clear(id: string) {
    if (inFlight.current) return;
    scrollPositions.delete(id);
    setExecutions((current) =>
      current[id] ? { ...current, [id]: { ...current[id], runs: [] } } : current,
    );
  }
  function toggle(id: string, runId: string) {
    setExecutions((current) =>
      current[id]
        ? {
            ...current,
            [id]: {
              ...current[id],
              runs: current[id].runs.map((record) =>
                record.id === runId ? { ...record, collapsed: !record.collapsed } : record,
              ),
            },
          }
        : current,
    );
  }
  return { executions, scrollPositions, runningId, run, isRunning, forget, clear, toggle };
}
