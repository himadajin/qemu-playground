import {
  LanguageSchema,
  TargetIdSchema,
  type Language,
  type TargetId,
} from "@qemu-playground/shared";

/**
 * Snippet persistence. Everything lives in LocalStorage under a single key:
 * snippets are independent scratch files, not a project, and nothing is ever
 * sent to the server (design.md).
 */

export const SNIPPET_STORAGE_KEY = "qemu-playground:snippets:v1";

export interface SavedSnippet {
  id: string;
  name: string;
  language: Language;
  target: TargetId;
  code: string;
  compileOptions: string;
  /** ISO timestamp of the last save; the list is ordered by it, newest first. */
  savedAt: string;
}

export type SnippetInput = Omit<SavedSnippet, "id" | "savedAt">;

/** Subset of the DOM Storage interface that this module needs. */
export interface SnippetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function parseSnippet(value: unknown): SavedSnippet | null {
  if (typeof value !== "object" || value === null) {
    return null;
  }
  const record = value as Record<string, unknown>;

  const language = LanguageSchema.safeParse(record["language"]);
  const target = TargetIdSchema.safeParse(record["target"]);
  if (!language.success || !target.success) {
    return null;
  }
  if (
    typeof record["id"] !== "string" ||
    typeof record["name"] !== "string" ||
    typeof record["code"] !== "string"
  ) {
    return null;
  }

  return {
    id: record["id"],
    name: record["name"],
    language: language.data,
    target: target.data,
    code: record["code"],
    compileOptions:
      typeof record["compileOptions"] === "string"
        ? record["compileOptions"]
        : "",
    savedAt:
      typeof record["savedAt"] === "string"
        ? record["savedAt"]
        : new Date(0).toISOString(),
  };
}

function sortNewestFirst(snippets: SavedSnippet[]): SavedSnippet[] {
  return [...snippets].sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

/** Reads all snippets. Unreadable or corrupt entries are skipped, not thrown. */
export function loadSnippets(storage: SnippetStorage): SavedSnippet[] {
  let raw: string | null;
  try {
    raw = storage.getItem(SNIPPET_STORAGE_KEY);
  } catch {
    return [];
  }
  if (raw === null) {
    return [];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(parsed)) {
    return [];
  }

  const snippets: SavedSnippet[] = [];
  for (const entry of parsed) {
    const snippet = parseSnippet(entry);
    if (snippet !== null) {
      snippets.push(snippet);
    }
  }
  return sortNewestFirst(snippets);
}

function writeSnippets(
  storage: SnippetStorage,
  snippets: SavedSnippet[],
): SavedSnippet[] {
  const ordered = sortNewestFirst(snippets);
  storage.setItem(SNIPPET_STORAGE_KEY, JSON.stringify(ordered));
  return ordered;
}

function newId(): string {
  const globalCrypto = globalThis.crypto as Crypto | undefined;
  if (globalCrypto && typeof globalCrypto.randomUUID === "function") {
    return globalCrypto.randomUUID();
  }
  return `snippet-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

/**
 * Saves a snippet under `input.name`, replacing any existing snippet with the
 * same name (keeping its id) so that re-saving is an update rather than a
 * silent duplicate. Returns the new list.
 */
export function saveSnippet(
  storage: SnippetStorage,
  input: SnippetInput,
  now: Date = new Date(),
): SavedSnippet[] {
  const name = input.name.trim();
  if (name === "") {
    throw new Error("Snippet name must not be empty");
  }

  const existing = loadSnippets(storage);
  const previous = existing.find((snippet) => snippet.name === name);
  const saved: SavedSnippet = {
    id: previous?.id ?? newId(),
    name,
    language: input.language,
    target: input.target,
    code: input.code,
    compileOptions: input.compileOptions,
    savedAt: now.toISOString(),
  };

  const rest = existing.filter((snippet) => snippet.id !== saved.id);
  return writeSnippets(storage, [saved, ...rest]);
}

/** Deletes one snippet by id. Returns the new list. */
export function deleteSnippet(
  storage: SnippetStorage,
  id: string,
): SavedSnippet[] {
  const remaining = loadSnippets(storage).filter(
    (snippet) => snippet.id !== id,
  );
  return writeSnippets(storage, remaining);
}
