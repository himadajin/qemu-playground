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
    const runId = result.current.executions[first.id]!.runs[0]!.id;
    act(() => result.current.toggle(first.id, runId));
    await flushUpdates(() => finish({ ok: false, message: "unavailable" }));
    expect(result.current.runningId).toBeNull();
    expect(result.current.executions[first.id]).toMatchObject({
      runs: [{ phase: { kind: "failed", message: "unavailable" }, collapsed: true }],
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

describe("bounded run history", () => {
  it("appends at submission, snapshots inputs, and preserves earlier results on failure", async () => {
    const file = createFile("c", "rv64", "original.c");
    const original = { ...file };
    const { result } = renderHook(useProgramExecution);
    vi.mocked(requestRun).mockResolvedValueOnce({
      ok: true,
      result: {
        status: "compile_error",
        compileLog: "first diagnostic",
        compileLogTruncated: false,
      },
    });
    await flushUpdates(() => {
      result.current.run(file);
    });
    const first = result.current.executions[file.id]!.runs[0]!;
    let reject!: (error: Error) => void;
    vi.mocked(requestRun).mockImplementationOnce(
      () =>
        new Promise((_, fail) => {
          reject = fail;
        }),
    );
    act(() => {
      result.current.run(file);
    });
    expect(result.current.executions[file.id]!.runs.map((run) => run.phase.kind)).toEqual([
      "result",
      "running",
    ]);
    Object.assign(file, {
      name: "renamed.c",
      code: "edited",
      target: "aarch64",
      compileOptions: "-O3",
    });
    act(() => {
      result.current.toggle(file.id, first.id);
    });
    await flushUpdates(() => reject(new Error("network failure")));
    const runs = result.current.executions[file.id]!.runs;
    expect(runs[0]).toMatchObject({ ...first, collapsed: true });
    expect(runs[1]).toMatchObject({
      sequence: 2,
      fileName: original.name,
      input: {
        code: original.code,
        target: original.target,
        compileOptions: original.compileOptions,
      },
      phase: { kind: "failed" },
    });
    expect(result.current.runningId).toBeNull();
  });

  it("evicts only the oldest of 20, preserves other files, and keeps sequence after Clear", async () => {
    const file = createFile();
    const other = createFile();
    const { result, unmount } = renderHook(useProgramExecution);
    vi.mocked(requestRun).mockResolvedValue({ ok: false, message: "busy" });
    await flushUpdates(() => {
      result.current.run(other);
    });
    for (let i = 0; i < 21; i++)
      await flushUpdates(() => {
        result.current.run(file);
      });
    expect(result.current.executions[file.id]!.runs.map((run) => run.sequence)).toEqual(
      Array.from({ length: 20 }, (_, i) => i + 2),
    );
    const retained = result.current.executions[other.id];
    act(() => result.current.clear(file.id));
    expect(result.current.executions[file.id]!.runs).toEqual([]);
    expect(result.current.executions[other.id]).toBe(retained);
    await flushUpdates(() => {
      result.current.run(file);
    });
    expect(result.current.executions[file.id]!.runs[0]!.sequence).toBe(22);
    result.current.scrollPositions.set(file.id, { top: 100, atBottom: false });
    act(() => result.current.forget(file.id));
    expect(result.current.scrollPositions.has(file.id)).toBe(false);
    expect(result.current.executions[file.id]).toBeUndefined();
    unmount();
    expect(renderHook(useProgramExecution).result.current.executions).toEqual({});
  });

  it("blocks Clear for every file while any request is running", async () => {
    const first = createFile();
    const second = createFile();
    const { result } = renderHook(useProgramExecution);
    vi.mocked(requestRun).mockResolvedValueOnce({ ok: false, message: "first" });
    await flushUpdates(() => {
      result.current.run(first);
    });
    let finish!: (outcome: RunOutcome) => void;
    vi.mocked(requestRun).mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    act(() => {
      result.current.run(second);
      result.current.clear(first.id);
      result.current.clear(second.id);
    });
    expect(result.current.executions[first.id]!.runs).toHaveLength(1);
    expect(result.current.executions[second.id]!.runs).toHaveLength(1);
    await flushUpdates(() => finish({ ok: false, message: "second" }));
  });
});
