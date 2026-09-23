import { Badge, Button, Group, Text } from "@mantine/core";
import { getTargetDefinition } from "@qemu-playground/shared";
import type { RunRecord } from "../hooks/useProgramExecution";
import { copyRunLog, fullRunTime, runOutcome, shortRunTime } from "../lib/runLog";
import { deriveResultView } from "../lib/runView";
import { CopyButton } from "./CopyButton";
import { StatusBadge } from "./StatusBadge";

function LogSection({
  title,
  text,
  truncated,
}: {
  title: string;
  text: string | null;
  truncated: boolean;
}) {
  if (!text) return null;
  return (
    <section className="log-section" aria-label={title}>
      <header className="log-section__head">
        <Text size="xs" c="dimmed">
          {title}
        </Text>
        {truncated && (
          <Badge size="xs" color="orange" variant="light">
            truncated
          </Badge>
        )}
      </header>
      <pre className="log">{text}</pre>
    </section>
  );
}

export function ResultPane({
  run,
  stale,
  onToggle,
  onView,
}: {
  run: RunRecord;
  stale: boolean;
  onToggle: (element: HTMLElement) => void;
  onView: (kind: "details" | "assembly", opener: HTMLButtonElement) => void;
}) {
  const view = deriveResultView(run.phase, run.input.language);
  const { output, build, assembly } = view;
  const extractionFailed =
    run.input.language === "c" &&
    run.phase.kind === "result" &&
    "assembly" in run.phase.result &&
    run.phase.result.assembly?.available &&
    run.phase.result.assembly.code === "";
  return (
    <article className="console-run" data-run-id={run.id} aria-label={`Run #${run.sequence}`}>
      <button
        className="console-run__head"
        aria-expanded={!run.collapsed}
        aria-controls={`run-${run.id}`}
        onClick={(event) => onToggle(event.currentTarget.parentElement!)}
      >
        <span aria-hidden="true" className="console-run__chevron">
          {run.collapsed ? "▸" : "▾"}
        </span>
        <span className="console-run__number">#{run.sequence}</span>
        <time dateTime={new Date(run.startedAt).toISOString()} title={fullRunTime(run.startedAt)}>
          {shortRunTime(run.startedAt)}
        </time>
        <span>{getTargetDefinition(run.input.target).displayName}</span>
        <span className="console-run__status">
          {view.badge && <StatusBadge kind={view.badge} />}
          {output.exit && view.badge !== "success" && <span>{output.exit}</span>}
          {run.phase.kind === "result" && run.phase.result.status === "timeout" && (
            <span>{run.phase.result.timeoutPhase}</span>
          )}
        </span>
      </button>
      {stale && <p className="console-run__note">Inputs changed since this run</p>}
      <div id={`run-${run.id}`} hidden={run.collapsed}>
        <Group gap="xs" className="console-run__actions">
          <Button
            variant="subtle"
            size="compact-xs"
            onClick={(event) => onView("details", event.currentTarget)}
          >
            Details
          </Button>
          <CopyButton
            label="Copy log"
            text={() => copyRunLog(run)}
            disabled={run.phase.kind === "running"}
          />
          {assembly.kind === "code" && (
            <Button
              variant="subtle"
              size="compact-xs"
              onClick={(event) => onView("assembly", event.currentTarget)}
            >
              View assembly
            </Button>
          )}
        </Group>
        <LogSection title="Build diagnostics" text={build.log} truncated={build.truncated} />
        <LogSection title="stdout" text={output.stdout} truncated={output.stdoutTruncated} />
        <LogSection title="stderr" text={output.stderr} truncated={output.stderrTruncated} />
        {extractionFailed && (
          <p className="console-run__note">
            Assembly extraction failed. See the build diagnostics above.
          </p>
        )}
        <p className="console-run__outcome" role="status">
          {runOutcome(view)}
        </p>
      </div>
    </article>
  );
}
