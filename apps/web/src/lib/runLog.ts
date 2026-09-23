import { getTargetDefinition } from "@qemu-playground/shared";
import type { RunRecord } from "../hooks/useProgramExecution";
import { deriveResultView, type ResultView } from "./runView";

export function fullRunTime(startedAt: number) {
  return new Date(startedAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "long" });
}
export function shortRunTime(startedAt: number) {
  const date = new Date(startedAt);
  return date.toDateString() === new Date().toDateString()
    ? date.toLocaleTimeString()
    : date.toLocaleString();
}
export function runOutcome(view: ResultView) {
  return [view.output.state, view.output.exit, ...view.output.log].filter(Boolean).join(" · ");
}
export function copyRunLog(run: RunRecord) {
  const view = deriveResultView(run.phase, run.input.language);
  const sections = [
    `Run #${run.sequence} · ${fullRunTime(run.startedAt)} · ${getTargetDefinition(run.input.target).displayName}`,
  ];
  for (const [label, text, truncated] of [
    ["Build diagnostics", view.build.log, view.build.truncated],
    ["stdout", view.output.stdout, view.output.stdoutTruncated],
    ["stderr", view.output.stderr, view.output.stderrTruncated],
  ] as const) {
    if (text) sections.push(`[${label}${truncated ? " — truncated" : ""}]\n${text}`);
  }
  sections.push(`[Outcome]\n${runOutcome(view)}`);
  return sections.join("\n\n");
}
