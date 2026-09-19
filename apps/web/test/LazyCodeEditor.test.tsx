// @vitest-environment jsdom
import "./ui.setup";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((accept, fail) => {
    resolve = accept;
    reject = fail;
  });
  return { promise, resolve, reject };
}

beforeEach(() => vi.resetModules());
afterEach(() => {
  vi.doUnmock("../src/components/CodeEditor");
  vi.restoreAllMocks();
});

it("shows the Suspense placeholder until the editor import resolves", async () => {
  const module = deferred<{ CodeEditor: () => React.JSX.Element }>();
  vi.doMock("../src/components/CodeEditor", () => module.promise);
  const { LazyCodeEditor } = await import("../src/components/LazyCodeEditor");
  const { MantineProvider } = await import("@mantine/core");
  render(
    <MantineProvider>
      <LazyCodeEditor value="ret" language="asm" target="rv64" ariaLabel="Source code" />
    </MantineProvider>,
  );
  expect(screen.getByRole("status", { name: "Loading editor" })).toBeVisible();
  await act(async () => {
    module.resolve({ CodeEditor: () => <div>Loaded editor</div> });
    await module.promise;
  });
  expect(await screen.findByText("Loaded editor")).toBeVisible();
  expect(screen.queryByRole("status", { name: "Loading editor" })).not.toBeInTheDocument();
});

it("contains a rejected editor import in an accessible error state", async () => {
  const module = deferred<never>();
  vi.doMock("../src/components/CodeEditor", () => module.promise);
  const { LazyCodeEditor } = await import("../src/components/LazyCodeEditor");
  const { MantineProvider } = await import("@mantine/core");
  vi.spyOn(console, "error").mockImplementation(() => {});
  render(
    <MantineProvider>
      <button>Run</button>
      <LazyCodeEditor value="ret" language="asm" target="rv64" ariaLabel="Source code" />
    </MantineProvider>,
  );
  expect(screen.getByRole("status", { name: "Loading editor" })).toBeVisible();
  await act(async () => {
    module.reject(new Error("Editor chunk unavailable"));
    await module.promise.catch(() => {});
  });
  expect(await screen.findByRole("alert")).toHaveTextContent("Reload the page to try again.");
  expect(screen.getByRole("button", { name: "Run" })).toBeEnabled();
  expect(screen.queryByRole("status", { name: "Loading editor" })).not.toBeInTheDocument();
});
