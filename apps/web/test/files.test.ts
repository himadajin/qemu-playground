import { describe, expect, it } from "vitest";
import {
  createFile,
  FILE_STORAGE_KEY,
  loadFiles,
  persistFiles,
  uniqueName,
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
describe("file collection persistence", () => {
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
