// @vitest-environment jsdom
import "./ui.setup";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { ResizableWorkspace } from "../src/components/ResizableWorkspace";

const key = "qemu-playground:workspace-ratio:v1";
let width = 1212;
let measure: () => void;

beforeEach(() => {
  localStorage.clear();
  width = 1212;
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (
    this: HTMLElement,
  ) {
    return {
      left: 0,
      right: this.tagName === "MAIN" ? width : 600,
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
      constructor(callback: () => void) {
        measure = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
});
afterEach(() => vi.restoreAllMocks());

function mount() {
  return render(
    <ResizableWorkspace
      code={<textarea aria-label="Source" defaultValue="edited code" />}
      result={<p>Result</p>}
    />,
  );
}

it("resizes with the keyboard, enforces both minimum widths, and restores the saved ratio", () => {
  const { unmount } = mount();
  const editor = screen.getByRole("textbox");
  const divider = screen.getByRole("separator");
  expect(divider).toHaveAttribute("aria-valuenow", "50");
  fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(Number(localStorage.getItem(key))).toBeCloseTo(616 / 1200);
  expect(screen.getByRole("textbox")).toBe(editor);
  for (let i = 0; i < 100; i++) fireEvent.keyDown(divider, { key: "ArrowLeft" });
  expect(Number(localStorage.getItem(key))).toBeCloseTo(320 / 1200);
  for (let i = 0; i < 100; i++) fireEvent.keyDown(divider, { key: "ArrowRight" });
  expect(Number(localStorage.getItem(key))).toBeCloseTo(880 / 1200);
  unmount();
  mount();
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "73");
});

it("constrains the displayed ratio on viewport resize without overwriting the preference", () => {
  localStorage.setItem(key, "0.7");
  mount();
  act(() => {
    width = 912;
    measure();
  });
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "64");
  expect(localStorage.getItem(key)).toBe("0.7");
  act(() => {
    width = 1212;
    measure();
  });
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "70");
});

it.each(["garbage", "0", "1", "Infinity", "-0.5"])("ignores invalid stored ratio %s", (value) => {
  localStorage.setItem(key, value);
  mount();
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "50");
});

it("remains adjustable if saving the preference fails", () => {
  vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
    throw new Error("blocked");
  });
  mount();
  fireEvent.keyDown(screen.getByRole("separator"), { key: "ArrowRight" });
  expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "51");
});

it("drags with pointer capture and stops resizing when capture is lost", () => {
  mount();
  const divider = screen.getByRole("separator");
  const capture = vi.fn();
  divider.setPointerCapture = capture;
  divider.releasePointerCapture = vi.fn();
  function pointer(type: string, clientX: number) {
    const event = new Event(type, { bubbles: true });
    Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX });
    fireEvent(divider, event);
  }
  pointer("pointerdown", 606);
  expect(capture).toHaveBeenCalledWith(1);
  pointer("pointermove", 806);
  expect(Number(localStorage.getItem(key))).toBeCloseTo(800 / 1200);
  pointer("pointermove", 2000);
  expect(Number(localStorage.getItem(key))).toBeCloseTo(880 / 1200);
  pointer("lostpointercapture", 2000);
  pointer("pointermove", 400);
  expect(Number(localStorage.getItem(key))).toBeCloseTo(880 / 1200);
});
