import { Alert } from "@mantine/core";
import { getTargetDefinition } from "@qemu-playground/shared";
import type { ReactNode } from "react";
import { ResultPane, type ResultTab } from "./ResultPane";
import type { Execution } from "../hooks/useProgramExecution";
import { sameProgram, type ProgramFile } from "../lib/files";
import { deriveResultView } from "../lib/runView";
export function ProgramResult({
  file,
  execution,
  runningId,
  runningFile,
  colorScheme,
  runButton,
  onTabChange,
}: {
  file: ProgramFile;
  execution: Execution | undefined;
  runningId: string | null;
  runningFile: ProgramFile | undefined;
  colorScheme: "light" | "dark";
  runButton: ReactNode;
  onTabChange: (tab: ResultTab) => void;
}) {
  const ownRunning = runningId === file.id;
  const view = deriveResultView(
    execution?.result
      ? { kind: "result", result: execution.result }
      : ownRunning
        ? { kind: "running" }
        : execution?.error
          ? { kind: "failed", message: execution.error }
          : { kind: "idle" },
    file.language,
  );
  const stale = !!execution?.input && !sameProgram(file, execution.input);
  return (
    <>
      <div className="execution-heading">
        <div className="execution-heading__context">
          <strong title={file.name}>{file.name}</strong>
          <span>{getTargetDefinition(file.target).displayName}</span>
        </div>
        {runButton}
      </div>
      {runningId && (
        <div className="execution-note" role="status">
          {ownRunning
            ? execution?.result
              ? "Running… Showing output from the previous run."
              : "Running…"
            : `Running ${runningFile?.name ?? "another file"}…`}
        </div>
      )}
      {execution?.input && (
        <div className="execution-snapshot">
          <span>
            {stale ? "Out of date · " : ""}Last run:{" "}
            {getTargetDefinition(execution.input.target).displayName}
          </span>
          <details>
            <summary>Run settings</summary>
            <div>
              Compiler options: <code>{execution.input.compileOptions || "default"}</code>
            </div>
          </details>
        </div>
      )}
      {execution?.error && execution.result && (
        <Alert color="red" variant="light" p="xs">
          {execution.error} Showing output from the previous run.
        </Alert>
      )}
      <ResultPane
        view={ownRunning ? { ...view, badge: "running" } : view}
        tab={execution?.tab ?? "output"}
        onTabChange={onTabChange}
        language={file.language}
        target={execution?.input?.target ?? file.target}
        colorScheme={colorScheme}
      />
    </>
  );
}
