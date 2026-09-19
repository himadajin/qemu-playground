// @vitest-environment jsdom
import "./ui.setup";
import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SIDEBAR_WIDTH,
  MAX_SIDEBAR_WIDTH,
  MIN_SIDEBAR_WIDTH,
  SIDEBAR_WIDTH_STORAGE_KEY,
  ResizableSidebarLayout,
} from "../src/components/ResizableSidebarLayout";

let width = 1200;

beforeEach(() => {
  localStorage.clear();
  width = 1200;
  vi.useFakeTimers();
  vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function () {
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
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

function view(opened = true) {
  return (
    <MantineProvider>
      <ResizableSidebarLayout opened={opened} sidebar={<nav aria-label="Files">Sidebar</nav>}>
        <main>Workbench</main>
      </ResizableSidebarLayout>
    </MantineProvider>
  );
}

function mount(opened = true) {
  return render(view(opened));
}

describe("resizable file sidebar", () => {
  it("resizes with the keyboard and persists the pixel width", () => {
    mount();
    const divider = screen.getByRole("separator", { name: "Resize files sidebar" });

    expect(divider).toHaveAttribute("aria-valuenow", String(DEFAULT_SIDEBAR_WIDTH));
    expect(divider).toHaveAttribute("aria-valuemin", String(MIN_SIDEBAR_WIDTH));
    expect(divider).toHaveAttribute("aria-valuemax", String(MAX_SIDEBAR_WIDTH));
    expect(divider).toHaveAttribute("aria-valuetext", "Files sidebar 240 pixels");

    fireEvent.keyDown(divider, { key: "ArrowRight" });
    expect(divider).toHaveAttribute("aria-valuenow", "256");
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("256");

    fireEvent.keyDown(divider, { key: "End" });
    expect(divider).toHaveAttribute("aria-valuenow", String(MAX_SIDEBAR_WIDTH));
    fireEvent.keyDown(divider, { key: "Home" });
    expect(divider).toHaveAttribute("aria-valuenow", String(MIN_SIDEBAR_WIDTH));
  });

  it("drags the divider and stops resizing after pointer release", () => {
    mount();
    const divider = screen.getByRole("separator", { name: "Resize files sidebar" });

    function pointer(target: HTMLElement | Document, type: string, clientX: number) {
      const event = new Event(type, { bubbles: true });
      Object.assign(event, { pointerId: 1, isPrimary: true, button: 0, clientX });
      fireEvent(target, event);
      act(() => {
        vi.advanceTimersByTime(20);
      });
    }

    pointer(divider, "pointerdown", DEFAULT_SIDEBAR_WIDTH);
    pointer(document, "pointermove", 400);
    expect(divider).toHaveAttribute("aria-valuenow", "400");
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("400");

    pointer(document, "pointerup", 400);
    pointer(document, "pointermove", 300);
    expect(divider).toHaveAttribute("aria-valuenow", "400");
  });

  it("clamps saved widths without rewriting the stored preference", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "500");
    const mounted = mount();
    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      String(MAX_SIDEBAR_WIDTH),
    );
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("500");

    mounted.unmount();
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "not-a-width");
    mount();
    expect(screen.getByRole("separator")).toHaveAttribute(
      "aria-valuenow",
      String(DEFAULT_SIDEBAR_WIDTH),
    );
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("not-a-width");
  });

  it("honors a saved width within the updated range", () => {
    localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, "180");
    mount();

    expect(screen.getByRole("separator")).toHaveAttribute("aria-valuenow", "180");
    expect(localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY)).toBe("180");
  });

  it("keeps the preferred width while collapsed and restores it on expansion", () => {
    const mounted = mount();
    const divider = screen.getByRole("separator", { name: "Resize files sidebar" });
    fireEvent.keyDown(divider, { key: "ArrowRight" });

    mounted.rerender(view(false));
    expect(
      screen.getByRole("separator", { name: "Resize files sidebar", hidden: true }),
    ).toHaveAttribute("aria-valuenow", "44");

    mounted.rerender(view(true));
    expect(screen.getByRole("separator", { name: "Resize files sidebar" })).toHaveAttribute(
      "aria-valuenow",
      "256",
    );
  });

  it("remains adjustable when saving the preference fails", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    mount();
    const divider = screen.getByRole("separator", { name: "Resize files sidebar" });
    fireEvent.keyDown(divider, { key: "ArrowRight" });
    expect(divider).toHaveAttribute("aria-valuenow", "256");
  });
});
