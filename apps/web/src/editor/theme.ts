import { EditorView } from "@codemirror/view";

export const editorTheme = EditorView.theme({
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
  ".cm-gutters": {
    color: "var(--mantine-color-dimmed)",
    backgroundColor: "var(--mantine-color-gray-0)",
    borderColor: "var(--mantine-color-default-border)",
  },
  ".cm-cursor": { borderLeftColor: "var(--mantine-color-text)" },
  ".cm-selectionBackground, &.cm-focused .cm-selectionBackground, .cm-content ::selection": {
    backgroundColor: "var(--mantine-color-blue-2)",
  },
  ".cm-searchMatch": { backgroundColor: "var(--mantine-color-yellow-2)" },
  ".cm-searchMatch.cm-searchMatch-selected": {
    backgroundColor: "var(--mantine-color-orange-2)",
    outline: "1px solid var(--mantine-color-orange-7)",
  },
  ".cm-panels": {
    color: "var(--mantine-color-text)",
    backgroundColor: "var(--mantine-color-gray-0)",
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
});
