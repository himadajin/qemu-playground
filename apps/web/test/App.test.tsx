// @vitest-environment jsdom
import "./ui.setup";
import { MantineProvider } from "@mantine/core";
import type { RunSuccessResult } from "@qemu-playground/shared";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useEffect } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "../src/App";
import { colorSchemeManager } from "../src/lib/colorScheme";
import {
  COLOR_SCHEME_MEDIA_QUERY,
  COLOR_SCHEME_STORAGE_KEY,
  DEFAULT_COLOR_SCHEME,
} from "../src/lib/colorSchemeConfig";
import { getSample } from "../src/lib/samples";
import { buildShareUrl } from "../src/lib/share";
import { saveSnippet } from "../src/lib/storage";
import { loadFiles } from "../src/lib/files";
import { theme } from "../src/theme";

// Replace only the editor engine: the real app, controls, protocol, and storage run together.
// DOM identity of the textarea detects accidental source-editor unmounts.
const editorDisposed = vi.hoisted(() => vi.fn());
vi.mock("../src/components/LazyCodeEditor", () => ({
  LazyCodeEditor: function TestEditor({
    value,
    ariaLabel,
    target,
    colorScheme,
    readOnly,
    onChange,
  }: {
    value: string;
    ariaLabel: string;
    target: string;
    colorScheme?: "light" | "dark";
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
        data-target={target}
        data-color-scheme={colorScheme}
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
type MediaChangeListener = (event: MediaQueryListEvent) => void;
const systemListeners = new Set<MediaChangeListener>();
let systemDark = false;

function createMediaQueryList(query: string): MediaQueryList {
  const isSystemColorScheme = query === COLOR_SCHEME_MEDIA_QUERY;
  const addListener = (listener: MediaChangeListener) => {
    if (isSystemColorScheme) systemListeners.add(listener);
  };
  const removeListener = (listener: MediaChangeListener) => {
    if (isSystemColorScheme) systemListeners.delete(listener);
  };
  return {
    matches: isSystemColorScheme && systemDark,
    media: query,
    onchange: null,
    addListener,
    removeListener,
    addEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (isSystemColorScheme && typeof listener === "function") {
        systemListeners.add(listener);
      }
    },
    removeEventListener: (_type: string, listener: EventListenerOrEventListenerObject) => {
      if (isSystemColorScheme && typeof listener === "function") {
        systemListeners.delete(listener);
      }
    },
    dispatchEvent: () => true,
  } as MediaQueryList;
}

function setSystemColorScheme(dark: boolean) {
  systemDark = dark;
  const event = { matches: dark, media: COLOR_SCHEME_MEDIA_QUERY } as MediaQueryListEvent;
  for (const listener of systemListeners) listener(event);
}

const fetchMock = vi.fn<typeof fetch>();
function mount(env: "test" | "default" = "test") {
  return render(
    <MantineProvider
      theme={theme}
      colorSchemeManager={colorSchemeManager}
      defaultColorScheme={DEFAULT_COLOR_SCHEME}
      env={env}
    >
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
  document.documentElement.removeAttribute("data-mantine-color-scheme");
  window.history.replaceState(null, "", "/");
  fetchMock.mockReset().mockResolvedValue(response(result));
  vi.stubGlobal("fetch", fetchMock);
  systemDark = false;
  systemListeners.clear();
  matchMediaMock.mockImplementation(createMediaQueryList);
});

describe("playground interactions", () => {
  it("changes theme from the icon menu, persists it, and follows the system in auto mode", async () => {
    const user = userEvent.setup();
    mount();

    expect(screen.getByRole("button", { name: "Theme: System" })).toBeVisible();
    expect(source()).toHaveAttribute("data-color-scheme", "light");

    await user.click(screen.getByRole("button", { name: "Theme: System" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Dark" }));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "dark");
      expect(source()).toHaveAttribute("data-color-scheme", "dark");
    });
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe("dark");
    expect(screen.getByRole("button", { name: "Theme: Dark" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Theme: Dark" }));
    await user.click(screen.getByRole("menuitemradio", { name: "System" }));
    expect(window.localStorage.getItem(COLOR_SCHEME_STORAGE_KEY)).toBe(DEFAULT_COLOR_SCHEME);
    expect(screen.getByRole("button", { name: "Theme: System" })).toBeVisible();

    act(() => setSystemColorScheme(true));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "dark");
      expect(source()).toHaveAttribute("data-color-scheme", "dark");
    });
    act(() => setSystemColorScheme(false));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "light");
      expect(source()).toHaveAttribute("data-color-scheme", "light");
    });
  });

  it("restores a persisted System choice before mount and follows the initial system scheme", async () => {
    systemDark = true;
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, DEFAULT_COLOR_SCHEME);
    mount();

    expect(screen.getByRole("button", { name: "Theme: System" })).toBeVisible();
    expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "dark");
    expect(source()).toHaveAttribute("data-color-scheme", "dark");

    act(() => setSystemColorScheme(false));
    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "light");
      expect(source()).toHaveAttribute("data-color-scheme", "light");
    });
  });

  it.each(["light", "dark"] as const)(
    "restores a persisted %s choice and ignores later system changes",
    (choice) => {
      systemDark = choice === "light";
      window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, choice);
      const mounted = mount();
      const label = choice === "light" ? "Light" : "Dark";

      expect(screen.getByRole("button", { name: `Theme: ${label}` })).toBeVisible();
      expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", choice);
      expect(source()).toHaveAttribute("data-color-scheme", choice);

      act(() => setSystemColorScheme(choice === "dark"));
      expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", choice);
      expect(source()).toHaveAttribute("data-color-scheme", choice);

      mounted.unmount();
      mount();
      expect(screen.getByRole("button", { name: `Theme: ${label}` })).toBeVisible();
      expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", choice);
    },
  );

  it("exposes the current theme choice through the radio menu semantics", async () => {
    const user = userEvent.setup();
    mount();

    await user.click(screen.getByRole("button", { name: "Theme: System" }));
    expect(screen.getByRole("menuitemradio", { name: "System" })).toHaveAttribute(
      "aria-checked",
      "true",
    );
    expect(screen.getByRole("menuitemradio", { name: "Light" })).toHaveAttribute(
      "aria-checked",
      "false",
    );
  });

  it("edits target and options inline without replacing source", async () => {
    const user = userEvent.setup();
    mount();
    expect(source()).toHaveValue(getSample("c", "rv64"));
    fireEvent.change(source(), { target: { value: "user edits" } });
    await user.selectOptions(screen.getByRole("combobox", { name: "Target" }), "aarch64");
    await user.type(screen.getByRole("textbox", { name: "Compile options" }), "-O2");
    expect(source()).toHaveValue("user edits");
    expect(loadFiles(localStorage).files[0]).toMatchObject({
      target: "aarch64",
      compileOptions: "-O2",
      code: "user edits",
    });
  });

  it("retains results while running, prevents duplicate requests, and lazily shows read-only assembly", async () => {
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
    expect(screen.getByRole("button", { name: "Running…" })).toBeDisabled();
    expect(screen.getByRole("tab", { name: "Output" })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("hello result")).toBeVisible();
    expect(screen.queryByRole("textbox", { name: "Generated assembly" })).not.toBeInTheDocument();
    await act(async () => {
      finish(response({ error: { code: "capacity_exceeded", message: "too busy" } }, 429));
      await Promise.resolve();
    });
    expect(await screen.findByText(/too busy/)).toBeVisible();
    expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
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
      matches: query === "(max-width: 1080px)",
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

  it("keeps generated assembly associated with its submitted target after the target changes", async () => {
    let finish!: (response: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise<Response>((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Run" }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Target" }), "aarch64");
    expect(source()).toHaveAttribute("data-target", "aarch64");
    await act(async () => {
      finish(response(result));
      await Promise.resolve();
    });
    await user.click(screen.getByRole("tab", { name: "Assembly" }));
    expect(screen.getByRole("textbox", { name: "Generated assembly" })).toHaveAttribute(
      "data-target",
      "rv64",
    );

    await user.click(screen.getByRole("button", { name: "Run" }));
    await screen.findByText("hello result");
    await user.click(screen.getByRole("tab", { name: "Assembly" }));
    expect(screen.getByRole("textbox", { name: "Generated assembly" })).toHaveAttribute(
      "data-target",
      "aarch64",
    );
  });

  it("keeps creation and import available while collapsed and remembers the preference", async () => {
    const user = userEvent.setup();
    let mounted = mount();
    const editor = source();
    await user.click(screen.getByRole("button", { name: "Hide files" }));
    expect(screen.queryByRole("navigation", { name: "Files" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show files" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    expect(source()).toBe(editor);
    expect(loadFiles(localStorage).sidebarOpen).toBe(false);

    await user.click(screen.getByRole("button", { name: "New" }));
    const dialog = screen.getByRole("dialog", { name: "New file" });
    await user.click(within(dialog).getByRole("button", { name: "New file" }));
    expect(loadFiles(localStorage).files).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Show files" })).toBeVisible();

    await user.upload(
      screen.getByLabelText("Import source file"),
      new File(["int main() { return 7; }"], "imported.c", { type: "text/plain" }),
    );
    const importDialog = await screen.findByRole("dialog", { name: "Import source" });
    await user.click(within(importDialog).getByRole("button", { name: "Import source" }));
    expect(source()).toHaveValue("int main() { return 7; }");
    expect(loadFiles(localStorage).sidebarOpen).toBe(false);

    mounted.unmount();
    mounted = mount();
    expect(screen.getByRole("button", { name: "Show files" })).toBeVisible();
    await user.click(screen.getByRole("button", { name: "Show files" }));
    expect(screen.getByRole("navigation", { name: "Files" })).toBeVisible();
    expect(screen.getByRole("button", { name: "imported.c" })).toBeVisible();
    expect(loadFiles(localStorage).sidebarOpen).toBe(true);
    mounted.unmount();
  });

  it("creates, renames, duplicates, and deletes files, preserving an empty collection", async () => {
    const user = userEvent.setup();
    const mounted = mount();
    await user.click(screen.getByRole("button", { name: "New" }));
    let dialog = screen.getByRole("dialog", { name: "New file" });
    await user.clear(within(dialog).getByLabelText("Filename"));
    await user.type(within(dialog).getByLabelText("Filename"), "startup");
    await user.selectOptions(within(dialog).getByLabelText("Program type"), "aarch64");
    await user.click(within(dialog).getByRole("button", { name: "New file" }));
    expect(source()).toHaveValue(getSample("asm", "aarch64"));
    expect(screen.queryByRole("combobox", { name: "Target" })).not.toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Assembly" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Actions for startup.s" }));
    await user.click(screen.getByRole("menuitem", { name: "Rename" }));
    dialog = screen.getByRole("dialog", { name: "Rename file" });
    await user.clear(within(dialog).getByLabelText("Filename"));
    await user.type(within(dialog).getByLabelText("Filename"), "entry{Enter}");
    await user.click(screen.getByRole("button", { name: "Actions for entry.s" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    expect(loadFiles(localStorage).files.map((f) => f.name)).toEqual([
      "hello.c",
      "entry.s",
      "entry-copy.s",
    ]);
    for (const name of ["entry-copy.s", "entry.s", "hello.c"]) {
      await user.click(screen.getByRole("button", { name: `Actions for ${name}` }));
      await user.click(screen.getByRole("menuitem", { name: "Delete" }));
      dialog = screen.getByRole("dialog", { name: "Delete file" });
      expect(within(dialog).getByText(`Delete “${name}”? This cannot be undone.`)).toBeVisible();
      await user.click(within(dialog).getByRole("button", { name: "Delete" }));
    }
    expect(screen.getByText("Start with a program")).toBeVisible();
    mounted.unmount();
    mount();
    expect(screen.getByText("Start with a program")).toBeVisible();
    expect(loadFiles(localStorage).files).toEqual([]);
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
    await user.click(screen.getByTitle("existing.s"));
    expect(source()).toHaveValue("saved code");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("owns late results by file, blocks overlapping runs, and restores selection after reload", async () => {
    saveSnippet(localStorage, {
      name: "other",
      language: "c",
      target: "aarch64",
      code: "other source",
      compileOptions: "-O3",
    });
    saveSnippet(
      localStorage,
      { name: "first", language: "c", target: "rv64", code: "first source", compileOptions: "" },
      new Date("2099-01-01"),
    );
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    const mounted = mount();
    await user.click(screen.getByRole("button", { name: "Run" }));
    await user.click(screen.getByRole("button", { name: "Actions for first.c" }));
    expect(screen.getByRole("menuitem", { name: "Delete" })).toBeDisabled();
    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "other.c" }));
    expect(source()).toHaveValue("other source");
    expect(screen.getByRole("button", { name: "Run" })).toBeDisabled();
    expect(screen.getByText("Running first.c…")).toBeVisible();
    await act(async () => {
      finish(response(result));
      await Promise.resolve();
    });
    expect(screen.queryByText("hello result")).not.toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0]?.[1]?.body as string)).toMatchObject({
      code: "first source",
      target: "rv64",
    });
    await user.click(screen.getByRole("button", { name: "first.c" }));
    expect(screen.getByText("hello result")).toBeVisible();
    fireEvent.change(source(), { target: { value: "changed" } });
    expect(screen.getByText(/Out of date/)).toBeVisible();
    fireEvent.change(source(), { target: { value: "first source" } });
    expect(screen.queryByText(/Out of date/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "other.c" }));
    mounted.unmount();
    mount();
    expect(source()).toHaveValue("other source");
    expect(screen.getByRole("textbox", { name: "Compile options" })).toHaveValue("-O3");
    await user.click(screen.getByRole("button", { name: "first.c" }));
    expect(screen.queryByText("hello result")).not.toBeInTheDocument();
  });

  it("keeps a shared preview separate and transfers its in-flight result when added", async () => {
    const shared = {
      language: "c" as const,
      target: "rv64" as const,
      code: "shared source",
      compileOptions: "-O2",
    };
    const url = buildShareUrl(window.location.href, shared);
    if (!url.ok) throw new Error("fixture");
    window.history.replaceState(null, "", url.url);
    let finish!: (value: Response) => void;
    fetchMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const user = userEvent.setup();
    mount();
    fireEvent.change(source(), { target: { value: "edited preview" } });
    expect(loadFiles(localStorage).files).toHaveLength(1);
    await user.click(screen.getByRole("button", { name: "hello.c" }));
    expect(source()).toHaveValue(getSample("c", "rv64"));
    await user.click(screen.getByRole("button", { name: "Shared preview" }));
    expect(source()).toHaveValue("edited preview");
    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(screen.getByRole("button", { name: "Close preview" })).toBeDisabled();
    await user.click(screen.getByRole("button", { name: "Add to files" }));
    const dialog = screen.getByRole("dialog", { name: "Add to files" });
    await user.click(within(dialog).getByRole("button", { name: "Add to files" }));
    expect(screen.queryByText("Not saved in your files")).not.toBeInTheDocument();
    expect(loadFiles(localStorage).files.at(-1)).toMatchObject({
      name: "shared.c",
      code: "edited preview",
      compileOptions: "-O2",
    });
    expect(window.location.hash).toBe("");
    await act(async () => {
      finish(response(result));
      await Promise.resolve();
    });
    expect(screen.getByText("hello result")).toBeVisible();
  });

  it("asks before discarding an edited preview without adding it", async () => {
    const url = buildShareUrl(window.location.href, {
      language: "c",
      target: "rv64",
      code: "shared",
      compileOptions: "",
    });
    if (!url.ok) throw new Error("fixture");
    window.history.replaceState(null, "", url.url);
    const user = userEvent.setup();
    mount();
    fireEvent.change(source(), { target: { value: "changed" } });
    await user.click(screen.getByRole("button", { name: "Close preview" }));
    await user.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(source()).toHaveValue("changed");
    await user.click(screen.getByRole("button", { name: "Close preview" }));
    await user.click(screen.getByRole("button", { name: "Discard preview" }));
    expect(source()).toHaveValue(getSample("c", "rv64"));
    expect(loadFiles(localStorage).files).toHaveLength(1);
  });

  it("reorders with the keyboard, cancels a move, and persists the committed order", async () => {
    const user = userEvent.setup();
    mount();
    await user.click(screen.getByRole("button", { name: "Actions for hello.c" }));
    await user.click(screen.getByRole("menuitem", { name: "Duplicate" }));
    const handle = screen.getByRole("button", { name: "Reorder hello-copy.c" });
    act(() => handle.focus());
    await user.keyboard(" {ArrowUp}{Escape}");
    expect(loadFiles(localStorage).files.map((f) => f.name)).toEqual(["hello.c", "hello-copy.c"]);
    act(() => handle.focus());
    await user.keyboard(" {ArrowUp} ");
    expect(loadFiles(localStorage).files.map((f) => f.name)).toEqual(["hello-copy.c", "hello.c"]);
  });

  it("imports an assembly copy only after choosing its architecture", async () => {
    const user = userEvent.setup();
    mount();
    const file = new File(["ret"], "example.s", { type: "text/plain" });
    Object.defineProperty(file, "text", { value: () => Promise.resolve("ret") });
    await user.upload(screen.getByLabelText("Import source file"), file);
    const dialog = await screen.findByRole("dialog", { name: "Import source" });
    expect(within(dialog).getByRole("combobox", { name: "Assembly architecture" })).toHaveValue("");
    await user.click(within(dialog).getByRole("button", { name: "Import source" }));
    expect(loadFiles(localStorage).files).toHaveLength(1);
    await user.selectOptions(
      within(dialog).getByRole("combobox", { name: "Assembly architecture" }),
      "aarch64",
    );
    await user.click(within(dialog).getByRole("button", { name: "Import source" }));
    expect(source()).toHaveValue("ret");
    expect(loadFiles(localStorage).files.at(-1)).toMatchObject({
      name: "example.s",
      language: "asm",
      target: "aarch64",
    });
  });

  it.each([false, true])(
    "can import the same file again after canceling (narrow: %s)",
    async (narrow) => {
      if (narrow) {
        matchMediaMock.mockImplementation((query) => ({
          ...createMediaQueryList(query),
          matches: query === "(max-width: 1080px)",
        }));
      }
      const user = userEvent.setup();
      mount();
      const file = new File(["int main(void) { return 0; }"], "example.c", { type: "text/plain" });
      Object.defineProperty(file, "text", {
        value: () => Promise.resolve("int main(void) { return 0; }"),
      });
      if (narrow) await user.click(screen.getByRole("button", { name: "Show files" }));
      await user.upload(screen.getByLabelText("Import source file"), file);
      const firstDialog = await screen.findByRole("dialog", { name: "Import source" });
      expect(screen.queryByRole("dialog", { name: "Your programs" })).not.toBeInTheDocument();
      await user.click(within(firstDialog).getByRole("button", { name: "Cancel" }));
      if (narrow) await user.click(screen.getByRole("button", { name: "Show files" }));
      await user.upload(screen.getByLabelText("Import source file"), file);
      const secondDialog = await screen.findByRole("dialog", { name: "Import source" });
      await user.click(within(secondDialog).getByRole("button", { name: "Import source" }));
      expect(source()).toHaveValue("int main(void) { return 0; }");
      expect(loadFiles(localStorage).files.at(-1)?.name).toBe("example.c");
    },
  );

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

  it("replaces copy failure with success and clears success on a later failure", async () => {
    const user = userEvent.setup();
    const copy = vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    mount();
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy");
    copy.mockResolvedValueOnce();
    await user.click(screen.getByRole("button", { name: "Share" }));
    expect(await screen.findByRole("button", { name: "Copied" })).toBeVisible();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Copied" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not copy");
    expect(screen.getByRole("button", { name: "Share" })).toBeVisible();
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
