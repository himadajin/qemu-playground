// @vitest-environment jsdom
import "./ui.setup";
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProgramWorkspace } from "../src/hooks/useProgramWorkspace";
import { useProgramExecution } from "../src/hooks/useProgramExecution";
import { createFile, FILE_STORAGE_KEY, loadFiles } from "../src/lib/files";
import { buildShareUrl } from "../src/lib/share";
import { requestRun, type RunOutcome } from "../src/lib/runApi";

vi.mock("../src/lib/runApi", () => ({ requestRun: vi.fn() }));
beforeEach(() => {
  localStorage.clear();
  window.history.replaceState(null, "", "/");
  vi.mocked(requestRun).mockReset();
});

// Persistence reports errors in a microtask; flush those updates with React effects.
async function flushUpdates(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

describe("workspace state transitions", () => {
  it("saves the latest preview edits and selection together without changing its identity", async () => {
    const shared = createFile();
    const url = buildShareUrl(window.location.href, shared);
    if (!url.ok) throw new Error("fixture URL is too long");
    window.history.replaceState(null, "", url.url);
    const { result } = renderHook(useProgramWorkspace);
    const id = result.current.preview!.id;
    expect(loadFiles(localStorage).files.some((file) => file.id === id)).toBe(false);
    await flushUpdates(() => {
      result.current.updateActive({ code: "edited", compileOptions: "-O2" });
      result.current.savePreview("saved.c");
    });
    expect(result.current.preview).toBeNull();
    expect(result.current.previewSelected).toBe(false);
    expect(result.current.active).toMatchObject({
      id,
      name: "saved.c",
      code: "edited",
      compileOptions: "-O2",
    });
    expect(loadFiles(localStorage).selectedId).toBe(id);
    expect(window.location.hash).toBe("");
  });

  it("selects a neighbor when deleting and preserves an intentionally empty collection", async () => {
    const { result, unmount } = renderHook(useProgramWorkspace);
    const first = result.current.active!;
    const second = createFile("c", "rv64", "second");
    const third = createFile("c", "rv64", "third");
    await flushUpdates(() => {
      result.current.add(second);
      result.current.add(third);
    });
    await flushUpdates(() => result.current.select(second.id));
    await flushUpdates(() => result.current.deleteFile(second.id));
    expect(result.current.active?.id).toBe(third.id);
    await flushUpdates(() => result.current.deleteFile(third.id));
    expect(result.current.active?.id).toBe(first.id);
    await flushUpdates(() => result.current.deleteFile(first.id));
    unmount();
    const restored = renderHook(useProgramWorkspace);
    expect(restored.result.current.active).toBeUndefined();
    expect(restored.result.current.collection.files).toEqual([]);
  });

  it("does not overwrite unreadable saved data when in-memory files change", async () => {
    localStorage.setItem(FILE_STORAGE_KEY, "broken");
    const { result } = renderHook(useProgramWorkspace);
    await flushUpdates(() => result.current.add(createFile()));
    expect(result.current.storageError).toContain("Saved files could not be read");
    expect(result.current.collection.files).toHaveLength(1);
    expect(localStorage.getItem(FILE_STORAGE_KEY)).toBe("broken");
  });
});

describe("execution ownership", () => {
  it("blocks overlapping runs before rerender and keeps a late response on its originating file", async () => {
    let finish!: (outcome: RunOutcome) => void;
    vi.mocked(requestRun).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const { result } = renderHook(useProgramExecution);
    const first = createFile();
    const second = createFile();
    act(() => {
      expect(result.current.run(first)).toBe(true);
      expect(result.current.isRunning(first.id)).toBe(true);
      expect(result.current.run(second)).toBe(false);
      result.current.forget(first.id);
    });
    expect(requestRun).toHaveBeenCalledTimes(1);
    act(() => result.current.selectTab(first.id, "build"));
    await flushUpdates(() => finish({ ok: false, message: "unavailable" }));
    expect(result.current.runningId).toBeNull();
    expect(result.current.executions[first.id]).toMatchObject({
      error: "unavailable",
      tab: "build",
    });
    expect(result.current.executions[second.id]).toBeUndefined();
    act(() => result.current.forget(first.id));
    expect(result.current.executions[first.id]).toBeUndefined();
    vi.mocked(requestRun).mockResolvedValueOnce({ ok: false, message: "retry" });
    await flushUpdates(() => {
      expect(result.current.run(second)).toBe(true);
    });
    expect(requestRun).toHaveBeenCalledTimes(2);
  });
});
