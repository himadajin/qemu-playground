// @vitest-environment jsdom
import "./ui.setup";
import { MantineProvider } from "@mantine/core";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { FileSidebar } from "../src/components/FileSidebar";
import { createFile, reorderFiles, type ProgramFile } from "../src/lib/files";

afterEach(() => {
  vi.restoreAllMocks();
  Reflect.deleteProperty(document, "elementFromPoint");
});

function setup() {
  const first = createFile("c", "rv64", "first");
  const second = createFile("asm", "aarch64", "second");
  const props = {
    files: [first, second],
    selectedId: first.id,
    runningId: null,
    preview: null,
    onSelect: vi.fn(),
    onAction: vi.fn(),
    onReorder: vi.fn<(ids: string[]) => void>(),
  };
  const view = (files: ProgramFile[]) => (
    <MantineProvider>
      <FileSidebar {...props} files={files} />
    </MantineProvider>
  );
  const mounted = render(view(props.files));
  return {
    ...props,
    first,
    second,
    rerender: (files: ProgramFile[]) => mounted.rerender(view(files)),
  };
}

function visibleOrder() {
  return [...document.querySelectorAll<HTMLElement>("[data-file-id]")].map(
    (row) => row.dataset.fileId,
  );
}

function pointer(handle: HTMLElement, type: string, button = 0) {
  const event = new MouseEvent(type, { bubbles: true, button, clientX: 10, clientY: 20 });
  Object.defineProperty(event, "pointerId", { value: 1 });
  fireEvent(handle, event);
}

function capturePointer(handle: HTMLElement, over: Element) {
  const setPointerCapture = vi.fn();
  Object.defineProperties(handle, {
    setPointerCapture: { value: setPointerCapture },
    hasPointerCapture: { value: () => setPointerCapture.mock.calls.length > 0 },
  });
  // jsdom does not implement pointer capture or layout hit testing.
  Object.defineProperty(document, "elementFromPoint", {
    configurable: true,
    value: () => over,
  });
  return setPointerCapture;
}

describe("file sidebar reordering", () => {
  it("commits pointer moves once and announces the position", () => {
    const { first, second, onReorder } = setup();
    const handle = screen.getByRole("button", { name: "Reorder second.s" });
    const capture = capturePointer(handle, screen.getByTitle("first.c"));

    pointer(handle, "pointerdown");
    expect(capture).toHaveBeenCalledWith(1);
    expect(handle).toHaveAttribute("aria-pressed", "true");
    pointer(handle, "pointermove");
    expect(visibleOrder()).toEqual([second.id, first.id]);
    expect(screen.getByRole("status")).toHaveTextContent("second.s, position 1 of 2.");
    expect(onReorder).not.toHaveBeenCalled();
    pointer(handle, "pointerup");
    fireEvent.blur(handle);
    expect(onReorder).toHaveBeenCalledExactlyOnceWith([second.id, first.id]);
    expect(handle).toHaveAttribute("aria-pressed", "false");
  });

  it("ignores secondary pointer buttons and restores the order on pointer cancellation", () => {
    const { first, second, onReorder } = setup();
    const handle = screen.getByRole("button", { name: "Reorder second.s" });
    const capture = capturePointer(handle, screen.getByTitle("first.c"));
    pointer(handle, "pointerdown", 2);
    pointer(handle, "pointermove");
    expect(capture).not.toHaveBeenCalled();
    expect(visibleOrder()).toEqual([first.id, second.id]);

    pointer(handle, "pointerdown");
    pointer(handle, "pointermove");
    pointer(handle, "pointercancel");
    fireEvent.blur(handle);
    expect(visibleOrder()).toEqual([first.id, second.id]);
    expect(onReorder).not.toHaveBeenCalled();
    expect(screen.getByRole("status")).toHaveTextContent("Reordering canceled.");
  });

  it("uses current file contents during a move and commits only IDs on blur", () => {
    const { first, second, onReorder, rerender } = setup();
    const handle = screen.getByRole("button", { name: "Reorder second.s" });
    fireEvent.keyDown(handle, { key: "Enter" });
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    const edited = { ...second, name: "renamed.s", code: "new source", compileOptions: "-O2" };
    const added = createFile("c", "rv64", "third");
    const current = [first, edited, added];
    rerender(current);
    expect(screen.getByTitle("renamed.s")).toBeVisible();
    expect(visibleOrder()).toEqual([second.id, first.id, added.id]);
    fireEvent.blur(handle);
    expect(onReorder).toHaveBeenCalledExactlyOnceWith([second.id, first.id]);
    const reordered = reorderFiles(current, onReorder.mock.calls[0]![0]);
    expect(reordered).toEqual([edited, first, added]);
    expect(reordered[0]).toBe(edited);
  });
});
