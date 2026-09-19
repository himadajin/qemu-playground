// @vitest-environment jsdom
import "./ui.setup";
import { runInNewContext } from "node:vm";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { COLOR_SCHEME_MEDIA_QUERY, COLOR_SCHEME_STORAGE_KEY } from "../src/lib/colorSchemeConfig";
import { getColorSchemeBootstrapScript } from "../src/lib/colorSchemeBootstrap";

const matchMediaMock = vi.fn<(query: string) => MediaQueryList>();
let systemDark = false;

Object.defineProperty(window, "matchMedia", {
  configurable: true,
  writable: true,
  value: matchMediaMock,
});

function createMediaQueryList(query: string): MediaQueryList {
  return {
    matches: query === COLOR_SCHEME_MEDIA_QUERY && systemDark,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

function runBootstrap() {
  // The production script is deliberately generated as a string so Vite can
  // inject it synchronously into the document head before the app bundle.
  runInNewContext(getColorSchemeBootstrapScript(), { window, document });
}

beforeEach(() => {
  window.localStorage.clear();
  document.documentElement.removeAttribute("data-mantine-color-scheme");
  systemDark = false;
  matchMediaMock.mockClear();
  matchMediaMock.mockImplementation(createMediaQueryList);
});

describe("color scheme bootstrap", () => {
  it("applies the system scheme before the application mounts", () => {
    systemDark = true;

    runBootstrap();

    expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "dark");
  });

  it.each([
    ["light", true, "light"],
    ["dark", false, "dark"],
  ] as const)("honors an explicit stored %s choice", (storedChoice, systemIsDark, expected) => {
    systemDark = systemIsDark;
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, storedChoice);

    runBootstrap();

    expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", expected);
    expect(matchMediaMock).not.toHaveBeenCalled();
  });

  it("falls back to System for an invalid stored value", () => {
    systemDark = true;
    window.localStorage.setItem(COLOR_SCHEME_STORAGE_KEY, "sepia");

    runBootstrap();

    expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "dark");
  });

  it("still evaluates the system scheme when LocalStorage is unavailable", () => {
    systemDark = true;
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("storage unavailable");
    });

    try {
      runBootstrap();
    } finally {
      getItem.mockRestore();
    }

    expect(document.documentElement).toHaveAttribute("data-mantine-color-scheme", "dark");
  });
});
