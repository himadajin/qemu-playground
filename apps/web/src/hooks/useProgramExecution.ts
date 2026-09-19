import { useRef, useState } from "react";
import type { RunResult } from "@qemu-playground/shared";
import type { ResultTab } from "../components/ResultPane";
import type { ProgramFile } from "../lib/files";
import type { ShareState } from "../lib/share";
import { requestRun } from "../lib/runApi";

export interface Execution {
  result?: RunResult;
  input?: ShareState;
  error?: string;
  tab: ResultTab;
}
export function useProgramExecution() {
  const [executions, setExecutions] = useState<Record<string, Execution>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);
  async function execute(file: ProgramFile) {
    const input: ShareState = {
      language: file.language,
      target: file.target,
      code: file.code,
      compileOptions: file.compileOptions,
    };

    setRunningId(file.id);
    setExecutions((current) => ({
      ...current,
      [file.id]: { ...current[file.id], error: undefined, tab: "output" },
    }));
    try {
      const outcome = await requestRun(input);
      setExecutions((current) => ({
        ...current,
        [file.id]: outcome.ok
          ? { result: outcome.result, input, tab: current[file.id]?.tab ?? "output" }
          : { ...current[file.id], error: outcome.message, tab: current[file.id]?.tab ?? "output" },
      }));
    } catch {
      setExecutions((current) => ({
        ...current,
        [file.id]: {
          ...current[file.id],
          error: "The Run could not be completed. Try again.",
          tab: "output",
        },
      }));
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
    setExecutions((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  }
  function selectTab(id: string, tab: ResultTab) {
    setExecutions((current) => ({ ...current, [id]: { ...current[id], tab } }));
  }
  return { executions, runningId, run, isRunning, forget, selectTab };
}
