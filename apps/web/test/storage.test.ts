import { beforeEach, describe, expect, it } from "vitest";
import {
  SNIPPET_STORAGE_KEY,
  deleteSnippet,
  loadSnippets,
  saveSnippet,
  type SnippetInput,
  type SnippetStorage,
} from "../src/lib/storage";

class MemoryStorage implements SnippetStorage {
  private readonly entries = new Map<string, string>();

  getItem(key: string): string | null {
    return this.entries.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.entries.set(key, value);
  }
}

const INPUT: SnippetInput = {
  name: "hello",
  language: "c",
  target: "rv64",
  code: "int main(void) { return 0; }",
  compileOptions: "-O2",
};

let storage: MemoryStorage;

beforeEach(() => {
  storage = new MemoryStorage();
});

describe("snippet storage", () => {
  it("starts empty", () => {
    expect(loadSnippets(storage)).toEqual([]);
  });

  it("saves and reads back every field", () => {
    saveSnippet(storage, INPUT, new Date("2026-01-01T00:00:00.000Z"));

    const [snippet] = loadSnippets(storage);
    expect(snippet).toMatchObject({
      name: "hello",
      language: "c",
      target: "rv64",
      code: INPUT.code,
      compileOptions: "-O2",
      savedAt: "2026-01-01T00:00:00.000Z",
    });
    expect(snippet?.id).toBeTypeOf("string");
  });

  it("lists the most recently saved snippet first", () => {
    saveSnippet(storage, INPUT, new Date("2026-01-01T00:00:00.000Z"));
    saveSnippet(
      storage,
      { ...INPUT, name: "later", target: "aarch64" },
      new Date("2026-02-01T00:00:00.000Z"),
    );

    expect(loadSnippets(storage).map((s) => s.name)).toEqual([
      "later",
      "hello",
    ]);
  });

  it("replaces a snippet of the same name, keeping its id", () => {
    saveSnippet(storage, INPUT, new Date("2026-01-01T00:00:00.000Z"));
    const originalId = loadSnippets(storage)[0]?.id;

    saveSnippet(
      storage,
      { ...INPUT, code: "updated" },
      new Date("2026-03-01T00:00:00.000Z"),
    );

    const snippets = loadSnippets(storage);
    expect(snippets).toHaveLength(1);
    expect(snippets[0]?.id).toBe(originalId);
    expect(snippets[0]?.code).toBe("updated");
  });

  it("trims the name and rejects an empty one", () => {
    saveSnippet(storage, { ...INPUT, name: "  spaced  " });
    expect(loadSnippets(storage)[0]?.name).toBe("spaced");
    expect(() => saveSnippet(storage, { ...INPUT, name: "   " })).toThrow();
  });

  it("deletes by id", () => {
    saveSnippet(storage, INPUT, new Date("2026-01-01T00:00:00.000Z"));
    saveSnippet(
      storage,
      { ...INPUT, name: "second" },
      new Date("2026-02-01T00:00:00.000Z"),
    );

    const target = loadSnippets(storage).find((s) => s.name === "hello");
    const remaining = deleteSnippet(storage, target?.id ?? "");

    expect(remaining.map((s) => s.name)).toEqual(["second"]);
    expect(loadSnippets(storage).map((s) => s.name)).toEqual(["second"]);
  });

  it("skips corrupt entries instead of failing the whole list", () => {
    storage.setItem(
      SNIPPET_STORAGE_KEY,
      JSON.stringify([
        { id: "1", name: "bad-target", language: "c", target: "x86", code: "" },
        {
          id: "2",
          name: "good",
          language: "asm",
          target: "aarch64",
          code: "nop",
          compileOptions: "",
          savedAt: "2026-01-01T00:00:00.000Z",
        },
        "not an object",
      ]),
    );

    expect(loadSnippets(storage).map((s) => s.name)).toEqual(["good"]);
  });

  it("recovers from an unparsable payload", () => {
    storage.setItem(SNIPPET_STORAGE_KEY, "{{{");
    expect(loadSnippets(storage)).toEqual([]);
  });
});
