// @vitest-environment jsdom
import "./ui.setup";
import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SIDEBAR_WIDTH_STORAGE_KEY,
  RESULTS_WIDTH_STORAGE_KEY,
  SidebarLayout,
} from "../src/components/SidebarLayout";

let width = 1200;
let observers: Set<() => void>;

function measure(nextWidth = width) {
  width = nextWidth;
  act(() => {
    observers.forEach((callback) => callback());
    vi.advanceTimersByTime(40);
  });
}

beforeEach(() => {
  localStorage.clear();
  width = 1200;
  observers = new Set();
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(() => ({
    left: 0,
    right: width,
    width,
    height: 600,
    top: 0,
    bottom: 600,
    x: 0,
    y: 0,
    toJSON() {},
  }));
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

function view(leftOpen = true, rightOpen = true, hasResults = true) {
  return (
    <MantineProvider>
      <SidebarLayout
        opened={leftOpen}
        sidebar={<nav>Files</nav>}
        results={hasResults ? { opened: rightOpen, content: <p>Results</p> } : undefined}
      >
        <textarea aria-label="Source" defaultValue="edited code" />
      </SidebarLayout>
    </MantineProvider>
  );
}

function mount() {
  const rendered = render(view());
  measure();
  return rendered;
}

const leftDivider = () => screen.getByRole("separator", { name: "Resize files sidebar" });
const rightDivider = () => screen.getByRole("separator", { name: "Resize results sidebar" });
const value = (divider: HTMLElement) => Number(divider.getAttribute("aria-valuenow"));

function pointer(target: HTMLElement | Document, type: string, clientX: number, flush = true) {
  const event = new Event(type, { bubbles: true });
  Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX });
  fireEvent(target, event);
  if (flush)
    act(() => {
      vi.advanceTimersByTime(20);
    });
}

describe("independent sidebars", () => {
  it("resizes either sidebar without moving the opposite side or remounting the editor", () => {
    mount();
    const editor = screen.getByRole("textbox");
    expect(value(leftDivider())).toBe(240);
    expect(value(rightDivider())).toBe(400);
    expect(leftDivider()).toHaveAttribute("aria-orientation", "vertical");
    expect(rightDivider()).toHaveAttribute("aria-controls", "desktop-results");
    fireEvent.keyDown(leftDivider(), { key: "ArrowRight" });
    expect(value(leftDivider())).toBe(256);
    expect(value(rightDivider())).toBe(400);
    fireEvent.keyDown(rightDivider(), { key: "ArrowLeft" });
    expect(value(leftDivider())).toBe(256);
    expect(value(rightDivider())).toBe(416);
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("256");
    expect(localStorage.getItem(RESULTS_WIDTH_STORAGE_KEY)).toBe("416");
    expect(screen.getByRole("textbox")).toBe(editor);
  });

  it("enforces sidebar limits and protects 320px of editor space", () => {
    mount();
    fireEvent.keyDown(leftDivider(), { key: "End" });
    expect(value(leftDivider())).toBe(420);
    expect(value(rightDivider())).toBe(400);
    fireEvent.keyDown(rightDivider(), { key: "End" });
    expect(value(rightDivider())).toBe(460);
    expect(value(leftDivider())).toBe(420);
    fireEvent.keyDown(rightDivider(), { key: "ArrowLeft" });
    expect(value(rightDivider())).toBe(460);
    fireEvent.keyDown(leftDivider(), { key: "Home" });
    expect(value(leftDivider())).toBe(160);
    fireEvent.keyDown(rightDivider(), { key: "Home" });
    expect(value(rightDivider())).toBe(320);
    expect(rightDivider()).toHaveAttribute("aria-valuetext", "Results sidebar 320 pixels");
  });

  it.each([0, 1] as const)("updates sidebar %i live and writes only on pointer release", (side) => {
    mount();
    const writes = vi.spyOn(Storage.prototype, "setItem");
    const divider = side === 0 ? leftDivider() : rightDivider();
    const start = side === 0 ? 240 : 800;
    pointer(divider, "pointerdown", start);
    pointer(document, "pointermove", start + 100);
    expect(value(divider)).toBe(side === 0 ? 340 : 320);
    expect(value(side === 0 ? rightDivider() : leftDivider())).toBe(side === 0 ? 400 : 240);
    expect(writes).not.toHaveBeenCalled();
    pointer(document, "pointerup", start + 100);
    expect(writes).toHaveBeenCalledTimes(1);
    pointer(document, "pointermove", start - 100);
    expect(value(divider)).toBe(side === 0 ? 340 : 320);
  });

  it("flushes the final pointer position even before the next animation frame", () => {
    mount();
    pointer(leftDivider(), "pointerdown", 240);
    pointer(document, "pointermove", 280, false);
    pointer(document, "pointerup", 300, false);
    expect(value(leftDivider())).toBe(300);
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("300");
  });

  it("restores the latest width of each side after successive pointer drags", () => {
    const rendered = mount();
    pointer(leftDivider(), "pointerdown", 240);
    pointer(document, "pointermove", 340);
    pointer(document, "pointerup", 340);
    pointer(rightDivider(), "pointerdown", 800);
    pointer(document, "pointermove", 700);
    pointer(document, "pointerup", 700);
    rendered.rerender(view(false, false));
    rendered.rerender(view());
    expect(value(leftDivider())).toBe(340);
    expect(value(rightDivider())).toBe(500);
  });

  it("follows the pointer back to its initial position during a drag", () => {
    mount();
    pointer(leftDivider(), "pointerdown", 240);
    pointer(document, "pointermove", 340);
    pointer(document, "pointermove", 240);
    expect(value(leftDivider())).toBe(240);
    pointer(document, "pointerup", 240);
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("240");
  });

  it("does not replace a constrained preference when a gesture makes no change", () => {
    localStorage.setItem(RESULTS_WIDTH_STORAGE_KEY, "900");
    mount();
    const position = width - value(rightDivider());
    pointer(rightDivider(), "pointerdown", position);
    pointer(document, "pointerup", position);
    expect(localStorage.getItem(RESULTS_WIDTH_STORAGE_KEY)).toBe("900");
  });

  it("temporarily shrinks both sidebars and restores their preferences when space returns", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "400");
    localStorage.setItem(RESULTS_WIDTH_STORAGE_KEY, "700");
    width = 1600;
    mount();
    measure(1100);
    const left = value(leftDivider());
    const right = value(rightDivider());
    expect(left).toBeLessThan(400);
    expect(right).toBeLessThan(700);
    expect(left + right).toBe(780);
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("400");
    expect(localStorage.getItem(RESULTS_WIDTH_STORAGE_KEY)).toBe("700");
    measure(1600);
    expect(value(leftDivider())).toBe(400);
    expect(value(rightDivider())).toBe(700);
  });

  it.each([0, 1] as const)(
    "keeps the opposite side fixed when resizing constrained sidebar %i",
    (side) => {
      localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "400");
      localStorage.setItem(RESULTS_WIDTH_STORAGE_KEY, "700");
      mount();
      const opposite = side === 0 ? rightDivider() : leftDivider();
      const original = value(opposite);
      fireEvent.keyDown(side === 0 ? leftDivider() : rightDivider(), {
        key: side === 0 ? "ArrowLeft" : "ArrowRight",
      });
      expect(value(opposite)).toBe(original);
      expect(
        localStorage.getItem(side === 0 ? RESULTS_WIDTH_STORAGE_KEY : SIDEBAR_WIDTH_STORAGE_KEY),
      ).toBe(side === 0 ? "700" : "400");
    },
  );

  it("keeps collapsed widths independent and restores each preference", () => {
    const rendered = mount();
    fireEvent.keyDown(rightDivider(), { key: "ArrowLeft" });
    rendered.rerender(view(false, true));
    expect(screen.queryByRole("separator", { name: "Resize files sidebar" })).toBeNull();
    expect(value(rightDivider())).toBe(416);
    rendered.rerender(view(true, false));
    expect(value(leftDivider())).toBe(240);
    expect(screen.queryByRole("separator", { name: "Resize results sidebar" })).toBeNull();
    rendered.rerender(view());
    expect(value(rightDivider())).toBe(416);
  });

  it("restores both pixel preferences after remount and ignores the old split ratio", () => {
    localStorage.setItem("qemu-playground:workspace-ratio:v1", "0.8");
    const rendered = mount();
    expect(value(rightDivider())).toBe(400);
    fireEvent.keyDown(leftDivider(), { key: "ArrowRight" });
    fireEvent.keyDown(rightDivider(), { key: "ArrowLeft" });
    rendered.unmount();
    mount();
    expect(value(leftDivider())).toBe(256);
    expect(value(rightDivider())).toBe(416);
  });

  it.each(["garbage", "0", "Infinity", "-10"])("ignores invalid stored widths %s", (stored) => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, stored);
    localStorage.setItem(RESULTS_WIDTH_STORAGE_KEY, stored);
    mount();
    expect(value(leftDivider())).toBe(240);
    expect(value(rightDivider())).toBe(400);
    expect(localStorage.getItem(RESULTS_WIDTH_STORAGE_KEY)).toBe(stored);
  });

  it("clamps stored widths without rewriting them or resetting on double click", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "500");
    localStorage.setItem(RESULTS_WIDTH_STORAGE_KEY, "100");
    mount();
    expect(value(leftDivider())).toBe(420);
    expect(value(rightDivider())).toBe(320);
    fireEvent.doubleClick(leftDivider());
    fireEvent.doubleClick(rightDivider());
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("500");
    expect(localStorage.getItem(RESULTS_WIDTH_STORAGE_KEY)).toBe("100");
  });

  it("remains adjustable when storage is blocked", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount();
    fireEvent.keyDown(leftDivider(), { key: "ArrowRight" });
    fireEvent.keyDown(rightDivider(), { key: "ArrowLeft" });
    expect(value(leftDivider())).toBe(256);
    expect(value(rightDivider())).toBe(416);
  });

  it("retains the file sidebar without a results panel in an empty workspace", () => {
    render(view(true, true, false));
    measure();
    expect(screen.getAllByRole("separator")).toHaveLength(1);
    fireEvent.keyDown(leftDivider(), { key: "End" });
    expect(value(leftDivider())).toBe(420);
  });

  it("resizes both sides after adding a program to an initially empty workspace", () => {
    const rendered = render(view(true, true, false));
    measure();
    rendered.rerender(view());
    pointer(leftDivider(), "pointerdown", 240);
    pointer(document, "pointerup", 300);
    expect(value(rightDivider())).toBe(400);
    pointer(rightDivider(), "pointerdown", 800);
    pointer(document, "pointerup", 700);
    rendered.rerender(view(false, false));
    rendered.rerender(view());
    expect(value(leftDivider())).toBe(300);
    expect(value(rightDivider())).toBe(500);
  });
});
