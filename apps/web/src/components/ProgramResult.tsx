import { Button } from "@mantine/core";
import { getTargetDefinition } from "@qemu-playground/shared";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { ResultPane } from "./ResultPane";
import { RunViewer } from "./RunViewer";
import { ConfirmDiscardDialog } from "./ConfirmDiscardDialog";
import { type Execution, type RunRecord } from "../hooks/useProgramExecution";
import { useConsoleScroll, type ConsolePosition } from "../hooks/useConsoleScroll";
import { sameProgram, type ProgramFile } from "../lib/files";

const EMPTY_RUNS: RunRecord[] = [];
export function ProgramResult({
  file,
  execution,
  runningId,
  runningFile,
  colorScheme,
  runButton,
  scrollPositions,
  onToggle,
  onClear,
}: {
  file: ProgramFile;
  execution: Execution | undefined;
  runningId: string | null;
  runningFile: ProgramFile | undefined;
  colorScheme: "light" | "dark";
  runButton: ReactNode;
  scrollPositions: Map<string, ConsolePosition>;
  onToggle: (runId: string) => void;
  onClear: () => void;
}) {
  const runs = execution?.runs ?? EMPTY_RUNS;
  const { viewport, content, atBottom, anchorHeader, jump } = useConsoleScroll(
    file.id,
    runs,
    scrollPositions,
  );
  const viewerOpener = useRef<HTMLButtonElement | null>(null);
  const [clearing, setClearing] = useState(false);
  const [viewer, setViewer] = useState<{ run: RunRecord; kind: "details" | "assembly" } | null>(
    null,
  );
  useLayoutEffect(() => {
    if (viewer || !viewerOpener.current) return;
    const target = viewerOpener.current.isConnected ? viewerOpener.current : viewport.current;
    target?.focus({ preventScroll: true });
    viewerOpener.current = null;
  }, [viewer, viewport]);
  return (
    <>
      <div className="execution-heading">
        <div className="execution-heading__context">
          <strong title={file.name}>{file.name}</strong>
          <span>{getTargetDefinition(file.target).displayName}</span>
        </div>
        {runButton}
      </div>
      {runningId && runningId !== file.id && (
        <div className="execution-note" role="status">
          Running {runningFile?.name ?? "another file"}…
        </div>
      )}
      <div className="console-toolbar">
        <strong>Console</strong>
        <Button
          variant="subtle"
          color="gray"
          size="compact-xs"
          disabled={!runs.length || runningId !== null}
          onClick={() => setClearing(true)}
        >
          Clear
        </Button>
      </div>
      <div
        className="console-scroll"
        ref={viewport}
        tabIndex={0}
        role="region"
        aria-label={`Console for ${file.name}`}
      >
        <div ref={content}>
          {runs.map((run, index) => (
            <ResultPane
              key={run.id}
              run={run}
              stale={index === runs.length - 1 && !sameProgram(file, run.input)}
              onToggle={(element) => {
                anchorHeader(element);
                onToggle(run.id);
              }}
              onView={(kind, opener) => {
                viewerOpener.current = opener;
                setViewer({ run, kind });
              }}
            />
          ))}
        </div>
      </div>
      {!atBottom && runs.length > 0 && (
        <div className="console-jump">
          <Button size="compact-xs" variant="light" onClick={jump}>
            Jump to latest
          </Button>
        </div>
      )}
      <ConfirmDiscardDialog
        opened={clearing}
        title="Clear console"
        cancelLabel="Cancel"
        confirmLabel="Clear history"
        disabled={runningId !== null || !runs.length}
        onClose={() => setClearing(false)}
        onConfirm={() => {
          onClear();
          setClearing(false);
        }}
      >
        Clear {runs.length} {runs.length === 1 ? "run" : "runs"} for “{file.name}”? Other files are
        unaffected. This cannot be undone.
      </ConfirmDiscardDialog>
      {viewer && (
        <RunViewer {...viewer} colorScheme={colorScheme} onClose={() => setViewer(null)} />
      )}
    </>
  );
}
