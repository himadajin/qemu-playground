import type * as Monaco from "monaco-editor/editor/editor.api";

/**
 * Monarch grammar for GNU assembler input.
 *
 * Monaco ships no generic `asm` language, and the two targets use different
 * conventions: RISC-V comments with `#`, AArch64 uses `#` for immediates and
 * `//` for comments. `#` is therefore read as a comment only when followed by
 * whitespace, and as an immediate otherwise.
 */
export const ASM_LANGUAGE_ID = "asm";

const registers =
  /\b(?:x[0-9]+|w[0-9]+|[atsx][0-9]+|sp|lr|pc|fp|ra|gp|tp|zero|xzr|wzr)\b/;

export const asmLanguage: Monaco.languages.IMonarchLanguage = {
  defaultToken: "",
  ignoreCase: false,
  tokenizer: {
    root: [
      [/^\s*[.A-Za-z_$][\w.$]*:/, "type.identifier"],
      [/\.[A-Za-z_][\w.]*/, "keyword"],
      [/\/\*/, "comment", "@blockComment"],
      [/\/\/.*$/, "comment"],
      [/;.*$/, "comment"],
      [/#(?:\s.*)?$/, "comment"],
      [/#[^\s]+/, "number"],
      [/"/, "string", "@string"],
      [/0[xX][0-9a-fA-F]+/, "number.hex"],
      [/\d+/, "number"],
      [registers, "variable.predefined"],
      [/[A-Za-z_][\w.]*/, "identifier"],
      [/[,()[\]{}+\-*/=<>!&|^~%]/, "operator"],
    ],
    blockComment: [
      [/[^/*]+/, "comment"],
      [/\*\//, "comment", "@pop"],
      [/[/*]/, "comment"],
    ],
    string: [
      [/[^\\"]+/, "string"],
      [/\\./, "string.escape"],
      [/"/, "string", "@pop"],
    ],
  },
};

export const asmLanguageConfiguration: Monaco.languages.LanguageConfiguration = {
  comments: {
    lineComment: "//",
    blockComment: ["/*", "*/"],
  },
  brackets: [
    ["(", ")"],
    ["[", "]"],
    ["{", "}"],
  ],
  autoClosingPairs: [
    { open: "(", close: ")" },
    { open: "[", close: "]" },
    { open: '"', close: '"' },
  ],
};
