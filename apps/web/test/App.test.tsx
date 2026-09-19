// @vitest-environment jsdom
import "./ui.setup";
import { MantineProvider } from "@mantine/core";
import type { RunSuccessResult } from "@qemu-playground/shared";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { getSample } from "../src/lib/samples";
import { buildShareUrl } from "../src/lib/share";
import { loadSnippets, saveSnippet } from "../src/lib/storage";
import { theme } from "../src/theme";

// Replace only the editor engine: the real app, controls, protocol, and storage run together.
// DOM identity of the textarea detects accidental source-editor unmounts.
const editorDisposed = vi.hoisted(() => vi.fn());
vi.mock("../src/components/CodeEditor", () => ({
  CodeEditor: function TestEditor({
    value,
    ariaLabel,
    readOnly,
    onChange,
  }: {
    value: string;
    ariaLabel: string;
    readOnly?: boolean;
    onChange?: (value: string) => void;
  }) {
    useEffect(
      () => () => {
        editorDisposed(ariaLabel);
      },
      [ariaLabel],
    );
    return (
      <textarea
        aria-label={ariaLabel}
        value={value}
        readOnly={readOnly}
        onChange={(event) => onChange?.(event.currentTarget.value)}
      />
    );
  },
}));

const result: RunSuccessResult = {
  status: "success",
  compileLog: "compiler warning",
  compileLogTruncated: true,
  stdout: "hello result",
  stdoutTruncated: true,
  stderr: "stderr result",
  stderrTruncated: false,
  exitCode: 42,
  assembly: { available: true, code: "ret", truncated: true },
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
const matchMediaMock = vi.fn<(query: string) => MediaQueryList>();
Object.defineProperty(window, "matchMedia", { writable: true, value: matchMediaMock });
const fetchMock = vi.fn<typeof fetch>();
function mount(env: "test" | "default" = "test") {
  return render(
    <MantineProvider theme={theme} forceColorScheme="light" env={env}>
      <App />
    </MantineProvider>,
  );
}
function source() {
  return screen.getByRole("textbox", { name: "Source code" });
}

beforeEach(() => {
  editorDisposed.mockClear();
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
  fetchMock.mockReset().mockResolvedValue(response(result));
  vi.stubGlobal("fetch", fetchMock);
  matchMediaMock.mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
});

describe("playground interactions", () => {
  it("changes untouched samples with keyboard controls, preserves edits, and keeps a target selected", async () => {
    const user = userEvent.setup();
    mount();
    expect(source()).toHaveValue(getSample("c", "rv64"));
    await user.click(screen.getByRole("radio", { name: "C" }));
    await user.keyboard("{ArrowRight}");
    expect(source()).toHaveValue(getSample("asm", "rv64"));
    const target = screen.getByRole("combobox", { name: "Target" });
    await user.click(target);
    await user.keyboard("{ArrowDown}{Enter}");
    expect(source()).toHaveValue(getSample("asm", "aarch64"));
    fireEvent.change(source(), { target: { value: "user edits" } });
    await user.click(screen.getByRole("radio", { name: "C" }));
    await user.click(target);
    await user.click(screen.getByRole("option", { name: /RV64/ }));
    expect(source()).toHaveValue("user edits");
    expect(target).not.toHaveValue("");
  });

  it("replaces results while running, prevents duplicate requests, and lazily shows read-only assembly", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText("hello result")).toBeVisible();
    expect(screen.getByText("stderr result")).toBeVisible();
    expect(screen.getByText("exit code 42")).toBeVisible();
    expect(screen.getByText("truncated")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Generated assembly" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("tab", { name: "Build" }));
    expect(screen.getByText("compiler warning")).toBeVisible();
    expect(screen.getByText("truncated")).toBeVisible();
    await user.click(screen.getByRole("tab", { name: "Assembly" }));
    expect(screen.getByRole("textbox", { name: "Generated assembly" })).toHaveAttribute("readonly");
    expect(screen.getByText(/assembly below is incomplete/)).toBeVisible();
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const run = screen.getByRole("button", { name: "Run" });
    act(() => {
      run.click();
      run.click();
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(screen.getByRole("button", { name: "Running" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Output" })).toHaveAttribute("aria-selected", "true");
    expect(screen.queryByText("hello result")).not.toBeInTheDocument();
    expect(screen.queryByRole("textbox", { name: "Generated assembly" })).not.toBeInTheDocument();
    await act(async () => {
      finish(response({ error: { code: "capacity_exceeded", message: "too busy" } }, 429));
      await Promise.resolve();
    });
    expect(await screen.findByText(/too busy/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
    await user.click(screen.getByRole("radio", { name: "Assembly" }));
    expect(screen.getByRole("tab", { name: "Assembly" })).toBeDisabled();
  });

  it.each([
    {
      body: { status: "compile_error", compileLog: "syntax error", compileLogTruncated: false },
      label: "compile error",
      detail: "The build failed; the program was not run.",
    },
    {
      body: {
        status: "runtime_error",
        compileLog: "",
        compileLogTruncated: false,
        stdout: "",
        stdoutTruncated: false,
        stderr: "fault",
        stderrTruncated: false,
        signal: "SIGSEGV",
        assembly: { available: false },
      },
      label: "runtime error",
      detail: "signal SIGSEGV",
    },
    {
      body: {
        status: "timeout",
        timeoutPhase: "run",
        compileLog: "",
        compileLogTruncated: false,
        stdout: "partial output",
        stdoutTruncated: false,
      },
      label: "timeout",
      detail: "Timed out while running.",
    },
  ])("displays $label with its details", async ({ body, label, detail }) => {
    fetchMock.mockResolvedValueOnce(response(body));
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByText(label, { exact: true })).toBeVisible();
    expect(screen.getByText(detail)).toBeVisible();
  });

  it("retains the source editor across narrow tabs and switches to Result on Run", async () => {
    matchMediaMock.mockImplementation((query: string) => ({
      matches: query === "(max-width: 900px)",
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    const user = userEvent.setup();
    // Exercise production tab lifecycle: Mantine test mode bypasses React Activity.
    mount("default");
    const editor = source();
    fireEvent.change(editor, { target: { value: "edited source" } });
    await user.click(screen.getByRole("tab", { name: "Result" }));
    expect(editor).toBeInTheDocument();
    expect(editorDisposed).not.toHaveBeenCalledWith("Source code");
    await user.click(screen.getByRole("tab", { name: "Code" }));
    expect(source()).toBe(editor);
    expect(source()).toHaveValue("edited source");
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("tab", { name: "Result" })).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByText("hello result")).toBeVisible();
  });

  it("saves, overwrites, opens and deletes existing snippets with named dialogs", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Save" }));
    let dialog = screen.getByRole("dialog", { name: "Save snippet" });
    expect(within(dialog).getByRole("button", { name: "Close save dialog" })).toBeEnabled();
    expect(within(dialog).getByRole("button", { name: "Save" })).toBeDisabled();
    const name = within(dialog).getByRole("textbox", { name: "Snippet name" });
    await waitFor(() => expect(name).toHaveFocus());
    await user.type(name, "demo{Enter}");
    expect(loadSnippets(localStorage)).toHaveLength(1);
    fireEvent.change(source(), { target: { value: "updated source" } });
    expect(screen.getByRole("button", { name: "Saved" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Saved" }));
    dialog = screen.getByRole("dialog", { name: "Save snippet" });
    expect(within(dialog).getByRole("textbox", { name: "Snippet name" })).toHaveValue("demo");
    await user.click(within(dialog).getByRole("button", { name: "Save" }));
    expect(loadSnippets(localStorage)).toHaveLength(1);
    expect(loadSnippets(localStorage)[0]?.code).toBe("updated source");
    fireEvent.change(source(), { target: { value: "other" } });
    await user.click(screen.getByRole("button", { name: "Open" }));
    const item = screen.getByRole("button", { name: /demo.*C/ });
    await waitFor(() => expect(item).toHaveFocus());
    await user.click(item);
    expect(source()).toHaveValue("updated source");
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: "Delete demo" }));
    expect(screen.getByText("Nothing saved yet.")).toBeVisible();
    expect(loadSnippets(localStorage)).toHaveLength(0);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("restores old share URLs and saved snippets without automatically running", async () => {
    const user = userEvent.setup();
    const state = {
      language: "asm" as const,
      target: "aarch64" as const,
      code: "shared code",
      compileOptions: "-O2",
    };
    const url = buildShareUrl(window.location.href, state);
    if (!url.ok) throw new Error("fixture URL is too long");
    window.history.replaceState(null, "", url.url);
    saveSnippet(localStorage, { ...state, code: "saved code", name: "existing" });
    mount();
    expect(source()).toHaveValue("shared code");
    expect(screen.getByRole("textbox", { name: "Compile options" })).toHaveValue("-O2");
    expect(fetchMock).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Open" }));
    await user.click(screen.getByRole("button", { name: /existing.*Assembly/ }));
    expect(source()).toHaveValue("saved code");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("confirms copying in the button and resets feedback two seconds after the latest copy", async () => {
    userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    vi.useFakeTimers();
    try {
      mount();
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Share" }));
        await Promise.resolve();
      });
      expect(copy).toHaveBeenCalledWith(window.location.href);
      expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Copied" }));
        await Promise.resolve();
      });
      act(() => {
        vi.advanceTimersByTime(1500);
      });
      expect(screen.getByRole("button", { name: "Copied" })).toBeVisible();
      act(() => {
        vi.advanceTimersByTime(500);
      });
      expect(screen.getByRole("button", { name: "Share" })).toBeVisible();
    } finally {
      vi.useRealTimers();
    }
  });

  it("keeps copy errors until dismissed and returns focus to Share", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    mount();
    await user.click(screen.getByRole("button", { name: "Share" }));
    vi.useFakeTimers();
    try {
      act(() => {
        vi.advanceTimersByTime(6000);
      });
      expect(screen.getByRole("alert")).toHaveTextContent("Copy the URL from the address bar.");
    } finally {
      vi.useRealTimers();
    }
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toHaveFocus();
    await user.click(screen.getByRole("button", { name: "Share" }));
    await user.tab();
    expect(screen.getByRole("button", { name: "Dismiss share error" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Share" })).toHaveFocus();
  });

  it("reports clipboard failure and rejects an oversized share URL", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    mount();
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByText(/Could not copy/)).toBeVisible();
    expect(window.location.hash).toMatch(/^#s=/);
    const previousHash = window.location.hash;
    const largeCode = Array.from({ length: 4000 }, (_, index) => `symbol_${index}`).join("\n");
    fireEvent.change(source(), { target: { value: largeCode } });
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByText(/Too long to share/)).toBeVisible();
    expect(window.location.hash).toBe(previousHash);
  });
});
