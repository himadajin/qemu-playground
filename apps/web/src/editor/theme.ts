import { HighlightStyle, syntaxHighlighting } from "@codemirror/language";
import type { Extension } from "@codemirror/state";
import { tags } from "@lezer/highlight";
import { EditorView } from "@codemirror/view";

export type EditorColorScheme = "light" | "dark";

const editorSurface = {
  "&": {
    height: "100%",
    color: "var(--mantine-color-text)",
    backgroundColor: "var(--mantine-color-body)",
    fontSize: "13px",
  },
  "&.cm-focused": {
    outline: "2px solid var(--mantine-primary-color-filled)",
    outlineOffset: "-2px",
  },
  ".cm-scroller": {
    overflow: "auto",
    fontFamily: "var(--mantine-font-family-monospace)",
    lineHeight: "1.55",
  },
  ".cm-content": { padding: "8px 0" },
  ".cm-cursor": { borderLeftColor: "var(--mantine-color-text)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--mantine-primary-color-light)",
  },
  ".cm-searchMatch": { backgroundColor: "var(--mantine-color-yellow-light)" },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "var(--mantine-color-orange-light)",
    outline: "1px solid var(--mantine-color-orange-outline)",
  },
  ".cm-panels": {
    color: "var(--mantine-color-text)",
    fontFamily: "var(--mantine-font-family)",
  },
  ".cm-panels-top": { borderBottom: "1px solid var(--mantine-color-default-border)" },
  ".cm-textfield, .cm-button": {
    color: "var(--mantine-color-text)",
    background: "var(--mantine-color-body)",
    border: "1px solid var(--mantine-color-default-border)",
    borderRadius: "var(--mantine-radius-sm)",
  },
  ".cm-panel :focus-visible": { outline: "2px solid var(--mantine-primary-color-filled)" },
};

const lightEditorTheme = EditorView.theme(
  {
    ...editorSurface,
    ".cm-gutters": {
      color: "var(--mantine-color-gray-7)",
      backgroundColor: "var(--mantine-color-gray-0)",
      borderColor: "var(--mantine-color-default-border)",
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "var(--mantine-color-gray-1)",
    },
    ".cm-panels": {
      ...editorSurface[".cm-panels"],
      backgroundColor: "var(--mantine-color-gray-0)",
    },
  },
  { dark: false },
);

const darkEditorTheme = EditorView.theme(
  {
    ...editorSurface,
    ".cm-gutters": {
      color: "var(--mantine-color-dark-1)",
      backgroundColor: "var(--mantine-color-dark-8)",
      borderColor: "var(--mantine-color-default-border)",
    },
    ".cm-activeLine, .cm-activeLineGutter": {
      backgroundColor: "var(--mantine-color-dark-6)",
    },
    ".cm-panels": {
      ...editorSurface[".cm-panels"],
      backgroundColor: "var(--mantine-color-dark-8)",
    },
  },
  { dark: true },
);

const lightHighlightStyle = HighlightStyle.define(
  [
    { tag: [tags.comment, tags.docComment], color: "var(--mantine-color-gray-7)" },
    {
      tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.definitionKeyword],
      color: "var(--mantine-color-blue-8)",
      fontWeight: "600",
    },
    {
      tag: [tags.typeName, tags.className, tags.namespace],
      color: "var(--mantine-color-teal-9)",
    },
    { tag: [tags.string, tags.docString, tags.character], color: "var(--mantine-color-green-9)" },
    { tag: [tags.number, tags.bool, tags.atom], color: "var(--mantine-color-orange-9)" },
    {
      tag: [tags.variableName, tags.propertyName, tags.labelName],
      color: "var(--mantine-color-violet-8)",
    },
    { tag: [tags.operator, tags.punctuation], color: "var(--mantine-color-gray-7)" },
    { tag: tags.invalid, color: "var(--mantine-color-red-9)", textDecoration: "underline" },
  ],
  { themeType: "light" },
);

const darkHighlightStyle = HighlightStyle.define(
  [
    { tag: [tags.comment, tags.docComment], color: "var(--mantine-color-dark-1)" },
    {
      tag: [tags.keyword, tags.controlKeyword, tags.operatorKeyword, tags.definitionKeyword],
      color: "var(--mantine-color-blue-3)",
      fontWeight: "600",
    },
    {
      tag: [tags.typeName, tags.className, tags.namespace],
      color: "var(--mantine-color-teal-3)",
    },
    { tag: [tags.string, tags.docString, tags.character], color: "var(--mantine-color-green-3)" },
    { tag: [tags.number, tags.bool, tags.atom], color: "var(--mantine-color-orange-3)" },
    {
      tag: [tags.variableName, tags.propertyName, tags.labelName],
      color: "var(--mantine-color-violet-3)",
    },
    { tag: [tags.operator, tags.punctuation], color: "var(--mantine-color-dark-1)" },
    { tag: tags.invalid, color: "var(--mantine-color-red-3)", textDecoration: "underline" },
  ],
  { themeType: "dark" },
);

export function editorTheme(colorScheme: EditorColorScheme): Extension {
  return [
    colorScheme === "dark" ? darkEditorTheme : lightEditorTheme,
    syntaxHighlighting(lightHighlightStyle),
    syntaxHighlighting(darkHighlightStyle),
  ];
}
