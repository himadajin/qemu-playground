// @vitest-environment jsdom
import "./ui.setup";
import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResizableWorkspace } from "../src/components/ResizableWorkspace";

const key = "qemu-playground:workspace-ratio:v1";
let width = 1200;
let observers: Set<() => void>;

function measure() {
  act(() => {
    observers.forEach((callback) => callback());
    vi.advanceTimersByTime(20);
  });
}

beforeEach(() => {
  localStorage.clear();
  width = 1200;
  observers = new Set();
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return {
      left: 0,
      right: width,
      width,
      height: 600,
      top: 0,
      bottom: 600,
      x: 0,
      y: 0,
      toJSON() {},
    };
  });
  vi.stubGlobal(
    "ResizeObserver",
    class {
      notify: () => void;
      constructor(callback: ResizeObserverCallback) {
        this.notify = () =>
          callback(
            [{ contentRect: { width, height: 600 } } as ResizeObserverEntry],
            this as unknown as ResizeObserver,
          );
      }
      observe() {
        observers.add(this.notify);
      }
      disconnect() {
        observers.delete(this.notify);
      }
    },
  );
});
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function mount() {
  const view = render(
    <MantineProvider>
      <ResizableWorkspace
        code={<textarea aria-label="Source" defaultValue="edited code" />}
        result={<p>Result</p>}
      />
    </MantineProvider>,
  );
  measure();
  return view;
}

it("resizes with the keyboard, enforces both minimum widths, and restores the saved ratio", () => {
  const { unmount } = mount();
  const editor = screen.getByRole("textbox");
  const divider = screen.getByRole("separator");
  expect(divider).toHaveAttribute("aria-valuenow", "600");
  fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(Number(localStorage.getItem(key))).toBeCloseTo(616 / 1200);
  expect(screen.getByRole("textbox")).toBe(editor);
  for (let i = 0; i < 100; i++) fireEvent.keyDown(divider, { key: "ArrowLeft" });
  expect(Number(localStorage.getItem(key))).toBeCloseTo(320 / 1200);
  for (let i = 0; i < 100; i++) fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(Number(localStorage.getItem(key))).toBeCloseTo(880 / 1200);
  unmount();
  mount();
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "880");
});

it("constrains the displayed ratio on viewport resize without overwriting the preference", () => {
  localStorage.setItem(key, "0.7");
  mount();
  act(() => {
    width = 900;
    measure();
  });
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "580");
  expect(localStorage.getItem(key)).toBe("0.7");
  act(() => {
    width = 1200;
    measure();
  });
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "840");
});

it.each(["garbage", "0", "1", "Infinity", "-0.5"])("ignores invalid stored ratio %s", (value) => {
  localStorage.setItem(key, value);
  mount();
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "600");
});

it("remains adjustable if saving the preference fails", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  mount();
  fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight" });
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "616");
});

it("drags the divider and stops resizing on pointer release", () => {
  mount();
  const divider = screen.getByRole("separator", { name: "Resize code and results" });
  function pointer(target: HTMLElement | Document, type: string, clientX: number) {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX });
    fireEvent(target, event);
    act(() => {
      vi.advanceTimersByTime(20);
    });
  }
  pointer(divider, "pointerdown", 600);
  pointer(document, "pointermove", 800);
  expect(Number(localStorage.getItem(key))).toBeCloseTo(800 / 1200);
  pointer(document, "pointerup", 800);
  pointer(document, "pointermove", 400);
  expect(Number(localStorage.getItem(key))).toBeCloseTo(800 / 1200);
});

it("does not reset the preferred ratio on double click", () => {
  localStorage.setItem(key, "0.6");
  mount();
  fireEvent.doubleClick(screen.getByRole("separator"));
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "720");
  expect(localStorage.getItem(key)).toBe("0.6");
});

it("falls back to equal widths if reading storage fails", () => {
  vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  mount();
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "600");
});
