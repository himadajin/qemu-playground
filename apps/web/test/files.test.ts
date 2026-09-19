import { describe, expect, it } from "vitest";
import {
  createFile,
  FILE_STORAGE_KEY,
  loadFiles,
  persistFiles,
  reorderFiles,
  uniqueName,
  validateFilename,
} from "../src/lib/files";
import { saveSnippet, SNIPPET_STORAGE_KEY, type SnippetStorage } from "../src/lib/storage";
function memory(): SnippetStorage {
  const data = new Map<string, string>();
  return {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}
describe("filename validation", () => {
  const files = [{ id: "existing", name: "hello.c" }];

  it("rejects blank input before normalization supplies a fallback", () => {
    expect(validateFilename(" \t ", "c", [])).toEqual({
      ok: false,
      error: "Enter a filename.",
    });
  });

  it("checks collisions after normalizing the name and fixing its extension", () => {
    expect(validateFilename(" hello.s ", "c", files)).toEqual({
      ok: false,
      error: "A file with this name already exists.",
    });
    expect(validateFilename("path/entry.C", "asm", [])).toEqual({
      ok: true,
      name: "path-entry.s",
    });
  });

  it("excludes only the renamed file from collision checks", () => {
    expect(validateFilename("hello", "c", files, "existing")).toEqual({
      ok: true,
      name: "hello.c",
    });
    expect(validateFilename("hello", "c", files, "another").ok).toBe(false);
  });
});

describe("file collection persistence", () => {
  it("applies an order without restoring removed files or dropping new files", () => {
    const first = createFile();
    const second = createFile("asm");
    const added = createFile();
    expect(
      reorderFiles([first, second, added], [second.id, "removed", second.id, first.id]),
    ).toEqual([second, first, added]);
  });
  it("creates a sample once and preserves an intentionally empty collection", () => {
    const storage = memory();
    const initial = loadFiles(storage);
    expect(initial.files[0]).toMatchObject({ name: "hello.c", language: "c", target: "rv64" });
    persistFiles(storage, { files: [], selectedId: null, sidebarOpen: false });
    expect(loadFiles(storage)).toEqual({ files: [], selectedId: null, sidebarOpen: false });
  });
  it("migrates every valid snippet, normalizes collisions, and leaves the old data intact", () => {
    const storage = memory();
    for (const name of ["hello", "hello.c", "hello.s", "path/hello"])
      saveSnippet(storage, {
        name,
        code: name,
        language: "c",
        target: "aarch64",
        compileOptions: "-O2",
      });
    const old = storage.getItem(SNIPPET_STORAGE_KEY);
    const collection = loadFiles(storage);
    expect(collection.files).toHaveLength(4);
    expect(new Set(collection.files.map((file) => file.name)).size).toBe(4);
    expect(
      collection.files.every((file) => file.name.endsWith(".c") && !file.name.includes("/")),
    ).toBe(true);
    expect(collection.files.map((file) => file.code).sort()).toEqual(
      ["hello", "hello.c", "hello.s", "path/hello"].sort(),
    );
    persistFiles(storage, collection);
    expect(loadFiles(storage)).toEqual(collection);
    expect(storage.getItem(SNIPPET_STORAGE_KEY)).toBe(old);
  });
  it("roundtrips manual order, selection, settings, and the sidebar preference", () => {
    const storage = memory();
    const a = createFile();
    const b = { ...createFile("asm", "aarch64", "entry"), compileOptions: "-g", code: "ret" };
    const collection = { files: [b, a], selectedId: a.id, sidebarOpen: false };
    persistFiles(storage, collection);
    expect(loadFiles(storage)).toEqual(collection);
    expect(uniqueName("hello-copy", "c", [{ ...a, name: "hello-copy.c" }])).toBe("hello-copy-2.c");
  });
  it("does not silently replace a corrupt collection", () => {
    const storage = memory();
    storage.setItem(FILE_STORAGE_KEY, "broken");
    expect(() => loadFiles(storage)).toThrow();
    expect(storage.getItem(FILE_STORAGE_KEY)).toBe("broken");
  });
});
