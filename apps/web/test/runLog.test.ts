import { describe, expect, it } from "vitest";
import type { RunRecord } from "../src/hooks/useProgramExecution";
import { copyRunLog } from "../src/lib/runLog";

const record: RunRecord = {
  id: "run",
  sequence: 7,
  startedAt: 0,
  fileName: "test.c",
  collapsed: false,
  input: { language: "c", target: "rv64", compileOptions: "", code: "secret source" },
  phase: {
    kind: "result",
    result: {
      status: "success",
      exitCode: 3,
      compileLog: "warning\n",
      compileLogTruncated: true,
      stdout: "  spaced\n\n",
      stdoutTruncated: false,
      stderr: "error\n",
      stderrTruncated: true,
      assembly: { available: true, code: "private assembly", truncated: false },
    },
  },
};
describe("copy log", () => {
  it("labels metadata, streams, truncation and outcome without exporting source or assembly", () => {
    const text = copyRunLog(record);
    expect(text).toContain("Run #7");
    expect(text).toContain("RV64");
    expect(text).toContain("[Build diagnostics — truncated]\nwarning\n");
    expect(text).toContain("[stdout]\n  spaced\n\n");
    expect(text).toContain("[stderr — truncated]\nerror\n");
    expect(text).toContain("[Outcome]\nProgram finished. · exit code 3");
    expect(text).not.toContain("secret source");
    expect(text).not.toContain("private assembly");
    expect(text.indexOf("Build diagnostics")).toBeLessThan(text.indexOf("stdout"));
    expect(text.indexOf("stdout")).toBeLessThan(text.indexOf("stderr"));
  });
  it("copies request failures without inventing empty output sections", () => {
    const text = copyRunLog({
      ...record,
      phase: { kind: "failed", message: "Server unavailable" },
    });
    expect(text).toContain("Server unavailable");
    expect(text).not.toContain("stdout");
    expect(text).not.toContain("Build diagnostics");
  });
});
