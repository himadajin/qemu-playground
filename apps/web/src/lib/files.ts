import {
  LanguageSchema,
  TargetIdSchema,
  type Language,
  type TargetId,
} from "@qemu-playground/shared";
import { getSample } from "./samples";
import { loadSnippets, type SnippetStorage } from "./storage";
import type { ShareState } from "./share";

export const FILE_STORAGE_KEY = "qemu-playground:files:v1";
export interface ProgramFile extends ShareState {
  id: string;
  name: string;
}
export interface FileCollection {
  files: ProgramFile[];
  selectedId: string | null;
  sidebarOpen: boolean;
}

export function filename(name: string, language: Language): string {
  const stem =
    name
      .trim()
      .replace(/[\\/\p{Cc}]/gu, "-")
      .replace(/\.(c|s)$/i, "")
      .trim() || "untitled";
  return `${stem}.${language === "c" ? "c" : "s"}`;
}
export function uniqueName(name: string, language: Language, files: ProgramFile[]): string {
  const normalized = filename(name, language);
  const stem = normalized.slice(0, -2);
  let candidate = normalized;
  let suffix = 2;
  while (files.some((file) => file.name === candidate))
    candidate = filename(`${stem}-${suffix++}`, language);
  return candidate;
}
export function createFile(
  language: Language = "c",
  target: TargetId = "rv64",
  name = "hello",
): ProgramFile {
  return {
    id: crypto.randomUUID(),
    name: filename(name, language),
    language,
    target,
    code: getSample(language, target),
    compileOptions: "",
  };
}

/** Array order is the user's order. An explicitly empty collection stays empty. */
export function loadFiles(storage: SnippetStorage): FileCollection {
  const raw = storage.getItem(FILE_STORAGE_KEY);
  if (raw !== null) {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("files" in parsed) ||
      !Array.isArray(parsed.files)
    )
      throw new Error("Invalid file collection");
    const files: ProgramFile[] = [];
    for (const entry of parsed.files) {
      const value = entry as Record<string, unknown>;
      if (
        typeof value !== "object" ||
        value === null ||
        typeof value.id !== "string" ||
        typeof value.name !== "string" ||
        typeof value.code !== "string" ||
        typeof value.compileOptions !== "string" ||
        !LanguageSchema.safeParse(value.language).success ||
        !TargetIdSchema.safeParse(value.target).success
      )
        throw new Error("Invalid saved file");
      const file = value as unknown as ProgramFile;
      files.push({
        ...file,
        id: files.some((item) => item.id === file.id) ? crypto.randomUUID() : file.id,
        name: uniqueName(file.name, file.language, files),
      });
    }
    const selected = "selectedId" in parsed ? parsed.selectedId : null;
    return {
      files,
      selectedId: files.find((file) => file.id === selected)?.id ?? files[0]?.id ?? null,
      sidebarOpen: !("sidebarOpen" in parsed) || parsed.sidebarOpen !== false,
    };
  }
  const files: ProgramFile[] = [];
  for (const snippet of loadSnippets(storage)) {
    files.push({
      id: crypto.randomUUID(),
      name: uniqueName(snippet.name, snippet.language, files),
      language: snippet.language,
      target: snippet.target,
      code: snippet.code,
      compileOptions: snippet.compileOptions,
    });
  }
  if (!files.length) files.push(createFile());
  return { files, selectedId: files[0]!.id, sidebarOpen: true };
}
export function persistFiles(storage: SnippetStorage, collection: FileCollection) {
  storage.setItem(FILE_STORAGE_KEY, JSON.stringify(collection));
}
export function sameProgram(a: ShareState, b: ShareState) {
  return (
    a.language === b.language &&
    a.target === b.target &&
    a.code === b.code &&
    a.compileOptions === b.compileOptions
  );
}
export function downloadFile(file: ProgramFile) {
  const url = URL.createObjectURL(new Blob([file.code], { type: "text/plain;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
