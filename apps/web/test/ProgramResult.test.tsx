// @vitest-environment jsdom
import "./ui.setup";
import { MantineProvider } from "@mantine/core";
import type { RunSuccessResult } from "@qemu-playground/shared";
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { ProgramResult } from "../src/components/ProgramResult";
import type { CodeEditorProps } from "../src/components/CodeEditor";
import type { RunRecord } from "../src/hooks/useProgramExecution";
import type { ConsolePosition } from "../src/hooks/useConsoleScroll";
import { createFile } from "../src/lib/files";

vi.mock("../src/components/LazyCodeEditor", () => ({
  LazyCodeEditor: ({ value, ariaLabel, target, searchRequest }: CodeEditorProps) => (
    <textarea
      readOnly
      aria-label={ariaLabel}
      value={value}
      data-target={target}
      data-search={searchRequest}
    />
  ),
}));
const file = createFile("c", "rv64", "historical.c");
const outcome: RunSuccessResult = {
  status: "success",
  compileLog: "warning\n",
  compileLogTruncated: true,
  stdout: "  hello\n\n",
  stdoutTruncated: false,
  stderr: "",
  stderrTruncated: false,
  exitCode: 0,
  assembly: { available: true, code: "ret", truncated: true },
};
const record: RunRecord = {
  id: "first",
  sequence: 1,
  startedAt: 0,
  fileName: file.name,
  input: { ...file },
  collapsed: false,
  phase: { kind: "result", result: outcome },
};
function Harness({
  initial = [record],
  runningId = null,
  colorScheme = "light",
}: {
  initial?: RunRecord[];
  runningId?: string | null;
  colorScheme?: "light" | "dark";
}) {
  const [runs, setRuns] = useState(initial);
  const [positions] = useState(() => new Map<string, ConsolePosition>());
  return (
    <MantineProvider env="test" forceColorScheme={colorScheme}>
      <ProgramResult
        file={{ ...file, name: "renamed.c", code: "changed", target: "aarch64" }}
        execution={{ runs, nextSequence: 3 }}
        runningId={runningId}
        runningFile={undefined}
        colorScheme={colorScheme}
        runButton={null}
        scrollPositions={positions}
        onToggle={(id) =>
          setRuns((previous) =>
            previous.map((run) => (run.id === id ? { ...run, collapsed: !run.collapsed } : run)),
          )
        }
        onClear={() => setRuns([])}
      />
    </MantineProvider>
  );
}

describe("Console records and viewers", () => {
  it.each(["light", "dark"] as const)(
    "shows ordered nonempty sections, outcome and historical metadata (%s)",
    async (colorScheme) => {
      const user = userEvent.setup();
      render(<Harness colorScheme={colorScheme} />);
      const article = screen.getByRole("article", { name: "Run #1" });
      expect(
        within(article)
          .getAllByRole("region")
          .map((node) => node.getAttribute("aria-label")),
      ).toEqual(["Build diagnostics", "stdout"]);
      expect(
        within(article).getByRole("region", { name: "stdout" }).querySelector("pre")?.textContent,
      ).toBe("  hello\n\n");
      expect(within(article).getByText("truncated")).toBeVisible();
      expect(screen.getByText("Inputs changed since this run")).toBeVisible();
      await user.click(within(article).getByRole("button", { name: "Details" }));
      const dialog = screen.getByRole("dialog", { name: "Run #1 · Details" });
      expect(within(dialog).getByText("historical.c")).toBeVisible();
      expect(within(dialog).getByRole("textbox", { name: "Captured source" })).toHaveValue(
        file.code,
      );
      expect(within(dialog).getByRole("textbox", { name: "Captured source" })).toHaveAttribute(
        "data-target",
        "rv64",
      );
      await user.click(within(dialog).getByRole("button", { name: "Find" }));
      expect(within(dialog).getByRole("textbox")).toHaveAttribute("data-search", "1");
      await user.keyboard("{Escape}");
      expect(within(article).getByRole("button", { name: "Details" })).toHaveFocus();
      await user.click(within(article).getByRole("button", { name: "Details" }));
      expect(screen.getByRole("textbox", { name: "Captured source" })).toHaveAttribute(
        "data-search",
        "0",
      );
      await user.keyboard("{Escape}");
      await user.click(within(article).getByRole("button", { name: "View assembly" }));
      expect(screen.getByRole("textbox", { name: "Generated assembly" })).toHaveValue("ret");
      expect(screen.getByText(/assembly below is incomplete/)).toBeVisible();
    },
  );

  it("folds by keyboard without hiding the exit state and marks only the latest input stale", async () => {
    const user = userEvent.setup();
    render(
      <Harness
        initial={[
          record,
          { ...record, id: "second", sequence: 2, phase: { kind: "failed", message: "offline" } },
        ]}
      />,
    );
    expect(screen.getAllByText("Inputs changed since this run")).toHaveLength(1);
    const first = within(screen.getByRole("article", { name: "Run #1" }));
    const header = first.getByRole("button", { expanded: true });
    act(() => header.focus());
    await user.keyboard("{Enter}");
    expect(header).toHaveAttribute("aria-expanded", "false");
    expect(first.getByText("exit 0")).toBeVisible();
    expect(first.queryByRole("button", { name: "Details" })).toBeNull();
    expect(screen.getByText(/offline/)).toBeVisible();
  });

  it("requires confirmation to Clear and disables it globally during execution", async () => {
    const user = userEvent.setup();
    const mounted = render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Clear" }));
    const dialog = screen.getByRole("dialog", { name: "Clear console" });
    expect(dialog).toHaveTextContent("Clear 1 run for “renamed.c”?");
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveAttribute(
      "data-autofocus",
    );
    await user.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.getByRole("article")).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Clear" }));
    await user.click(screen.getByRole("button", { name: "Clear history" }));
    expect(screen.getByText("Run this file to see output here.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
    mounted.unmount();
    render(<Harness runningId="other-file" />);
    expect(screen.getByRole("button", { name: "Clear" })).toBeDisabled();
  });

  it("hides empty assembly and separates extraction failure from successful execution", () => {
    render(
      <Harness
        initial={[
          {
            ...record,
            phase: {
              kind: "result",
              result: { ...outcome, assembly: { available: true, code: "", truncated: false } },
            },
          },
        ]}
      />,
    );
    expect(screen.queryByRole("button", { name: "View assembly" })).toBeNull();
    expect(screen.getByText(/Assembly extraction failed/)).toBeVisible();
    expect(screen.getByText("exit 0")).toBeVisible();
  });

  it("copies a labeled log and reports both clipboard outcomes", async () => {
    const user = userEvent.setup();
    const write = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Copy log" }));
    expect(write).toHaveBeenCalledWith(expect.stringContaining("[Build diagnostics — truncated]"));
    expect(write.mock.calls[0]![0]).not.toContain(file.code);
    expect(screen.getByText("Copied")).toBeVisible();
    write.mockRejectedValueOnce(new Error("denied"));
    await user.click(screen.getByRole("button", { name: "Copy log" }));
    expect(screen.getByText("Could not copy. Try again.")).toBeVisible();
  });

  it("keeps a running record distinct, with captured Details and disabled log copying", () => {
    const mounted = render(
      <Harness
        initial={[record, { ...record, id: "pending", sequence: 2, phase: { kind: "running" } }]}
        runningId={file.id}
      />,
    );
    const pending = within(screen.getByRole("article", { name: "Run #2" }));
    expect(pending.getByRole("button", { name: "Copy log" })).toBeDisabled();
    expect(pending.queryByRole("region", { name: "stdout" })).toBeNull();
    fireEvent.click(pending.getByRole("button", { name: "Details" }));
    expect(screen.getByRole("textbox", { name: "Captured source" })).toHaveValue(file.code);
    mounted.unmount();
  });
});
