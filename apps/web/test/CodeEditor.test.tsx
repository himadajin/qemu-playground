// @vitest-environment jsdom
import "./ui.setup";
import { deleteCharForward, toggleComment, undoDepth } from "@codemirror/commands";
import { ensureSyntaxTree } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { act, render, screen } from "@testing-library/react";
import { StrictMode, useState } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CodeEditor } from "../src/components/CodeEditor";
import type { CodeEditorProps, EditorSessions } from "../src/components/CodeEditor";

beforeAll(() => {
  Range.prototype.getClientRects = () => [] as unknown as DOMRectList;
  Range.prototype.getBoundingClientRect = () => new DOMRect();
});
afterEach(() => vi.restoreAllMocks());

const defaults: CodeEditorProps = {
  value: "int main() {}",
  language: "c",
  target: "rv64",
  ariaLabel: "Source code",
};

function currentView(label = "Source code") {
  return EditorView.findFromDOM(screen.getByRole("textbox", { name: label }))!;
}

function edit(view: EditorView) {
  act(() => view.dispatch({ changes: { from: 0, insert: "// edit\n" }, selection: { anchor: 3 } }));
}

describe("CodeEditor integration", () => {
  it("notifies editor changes once and preserves state when React echoes the value", () => {
    const onChange = vi.fn();
    function ControlledEditor() {
      const [value, setValue] = useState(defaults.value);
      return (
        <CodeEditor
          {...defaults}
          value={value}
          onChange={(next) => {
            onChange(next);
            setValue(next);
          }}
        />
      );
    }
    render(<ControlledEditor />);
    const view = currentView();
    const replace = vi.spyOn(view, "setState");
    edit(view);
    expect(onChange).toHaveBeenCalledExactlyOnceWith("// edit\nint main() {}");
    expect(replace).not.toHaveBeenCalled();
    expect(view.state.selection.main.head).toBe(3);
    expect(undoDepth(view.state)).toBe(1);
    expect(currentView()).toBe(view);
  });

  it("resets history, selection and scroll for a different external document without a feedback loop", () => {
    const onChange = vi.fn();
    const { rerender } = render(<CodeEditor {...defaults} onChange={onChange} />);
    const view = currentView();
    edit(view);
    view.scrollDOM.scrollTop = 100;
    view.scrollDOM.scrollLeft = 80;
    onChange.mockClear();
    rerender(<CodeEditor {...defaults} value="new sample" onChange={onChange} />);
    expect(currentView()).toBe(view);
    expect(view.state.doc.toString()).toBe("new sample");
    expect(view.state.selection.main.head).toBe(0);
    expect(view.state.selection.main.empty).toBe(true);
    expect(undoDepth(view.state)).toBe(0);
    expect(view.scrollDOM.scrollTop).toBe(0);
    expect(view.scrollDOM.scrollLeft).toBe(0);
    expect(onChange).not.toHaveBeenCalled();
  });

  it("reconfigures language, target, label and read-only access without replacing the view or editing state", () => {
    const { rerender } = render(<CodeEditor {...defaults} />);
    const view = currentView();
    edit(view);
    const value = view.state.doc.toString();
    const replace = vi.spyOn(view, "setState");
    view.scrollDOM.scrollTop = 60;
    view.scrollDOM.scrollLeft = 30;
    for (const props of [
      { language: "asm", target: "rv64" },
      { language: "asm", target: "aarch64" },
      { language: "asm", target: "aarch64", readOnly: true },
      { language: "c", target: "aarch64", readOnly: false },
    ] as const) {
      rerender(<CodeEditor {...defaults} {...props} value={value} ariaLabel="Code" />);
      expect(currentView("Code")).toBe(view);
      expect(view.state.selection.main.head).toBe(3);
      expect(undoDepth(view.state)).toBe(1);
      expect(view.scrollDOM.scrollTop).toBe(60);
      expect(view.scrollDOM.scrollLeft).toBe(30);
      expect(view.state.readOnly).toBe("readOnly" in props && props.readOnly);
    }
    expect(replace).not.toHaveBeenCalled();
  });

  it("reconfigures the editor color scheme without replacing the view or editing state", () => {
    const { rerender } = render(<CodeEditor {...defaults} colorScheme="light" />);
    const view = currentView();
    edit(view);
    const value = view.state.doc.toString();
    const replace = vi.spyOn(view, "setState");
    view.scrollDOM.scrollTop = 60;
    view.scrollDOM.scrollLeft = 30;

    rerender(<CodeEditor {...defaults} value={value} colorScheme="dark" />);
    expect(currentView()).toBe(view);
    expect(view.state.facet(EditorView.darkTheme)).toBe(true);
    expect(view.state.selection.main.head).toBe(3);
    expect(undoDepth(view.state)).toBe(1);
    expect(view.scrollDOM.scrollTop).toBe(60);
    expect(view.scrollDOM.scrollLeft).toBe(30);

    rerender(<CodeEditor {...defaults} value={value} colorScheme="light" />);
    expect(view.state.facet(EditorView.darkTheme)).toBe(false);
    expect(replace).not.toHaveBeenCalled();
  });

  it("restores per-file history, selection and scroll, including identical documents and remounts", () => {
    const sessions: EditorSessions = new Map();
    const { rerender, unmount } = render(
      <CodeEditor {...defaults} fileId="a" sessions={sessions} />,
    );
    const view = currentView();
    edit(view);
    const value = view.state.doc.toString();
    view.scrollDOM.scrollTop = 70;
    view.scrollDOM.scrollLeft = 30;
    rerender(<CodeEditor {...defaults} value={value} fileId="b" sessions={sessions} />);
    expect(undoDepth(view.state)).toBe(0);
    expect(view.state.selection.main.head).toBe(0);
    act(() => view.dispatch({ selection: { anchor: 6 } }));
    rerender(
      <CodeEditor {...defaults} value={value} fileId="a" sessions={sessions} colorScheme="dark" />,
    );
    expect(undoDepth(view.state)).toBe(1);
    expect(view.state.selection.main.head).toBe(3);
    expect(view.scrollDOM.scrollTop).toBe(70);
    expect(view.scrollDOM.scrollLeft).toBe(30);
    expect(view.state.facet(EditorView.darkTheme)).toBe(true);
    unmount();
    const onChange = vi.fn();
    render(
      <CodeEditor {...defaults} value={value} fileId="a" sessions={sessions} onChange={onChange} />,
    );
    const restored = currentView();
    expect(undoDepth(restored.state)).toBe(1);
    expect(restored.state.selection.main.head).toBe(3);
    expect(restored.scrollDOM.scrollTop).toBe(70);
    edit(restored);
    expect(onChange).toHaveBeenCalledOnce();
  });

  it("uses the latest onChange without rebuilding the view", () => {
    const previous = vi.fn();
    const next = vi.fn();
    const { rerender } = render(<CodeEditor {...defaults} onChange={previous} />);
    const view = currentView();
    rerender(<CodeEditor {...defaults} onChange={next} />);
    edit(view);
    expect(previous).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalledOnce();
    expect(currentView()).toBe(view);
  });

  it("keeps generated assembly focusable and selectable while blocking editing commands", () => {
    const onChange = vi.fn();
    render(
      <CodeEditor
        {...defaults}
        value="ret"
        language="asm"
        readOnly
        ariaLabel="Generated assembly"
        onChange={onChange}
      />,
    );
    const view = currentView("Generated assembly");
    expect(view.state.readOnly).toBe(true);
    expect(view.contentDOM).toHaveAttribute("contenteditable", "false");
    expect(view.contentDOM).toHaveAttribute("tabindex", "0");
    expect(view.contentDOM).toHaveAttribute("aria-readonly", "true");
    act(() => {
      view.focus();
      view.dispatch({ selection: { anchor: 0, head: 3 } });
      expect(deleteCharForward(view)).toBe(false);
      expect(toggleComment(view)).toBe(false);
    });
    expect(view.contentDOM).toHaveFocus();
    expect(view.state.sliceDoc(view.state.selection.main.from, view.state.selection.main.to)).toBe(
      "ret",
    );
    expect(onChange).not.toHaveBeenCalled();
  });

  it("disposes the real view on unmount, including under StrictMode", () => {
    const { unmount } = render(
      <StrictMode>
        <CodeEditor {...defaults} />
      </StrictMode>,
    );
    const view = currentView();
    const destroy = vi.spyOn(view, "destroy");
    expect(document.querySelectorAll(".cm-editor")).toHaveLength(1);
    unmount();
    expect(destroy).toHaveBeenCalledOnce();
    expect(view.dom.isConnected).toBe(false);
  });

  it.each([
    ["rv64", "# ret"],
    ["aarch64", "// ret"],
  ] as const)("configures %s comment toggling with the target's syntax", (target, expected) => {
    render(<CodeEditor {...defaults} value="ret" language="asm" target={target} />);
    const view = currentView();
    act(() => {
      toggleComment(view);
    });
    expect(view.state.doc.toString()).toBe(expected);
  });

  it("adapts AArch64 line comments without confusing immediates, strings or block comments", () => {
    const value = 'mov x0, #1 // line\n.ascii "// string"\n/* block\n// inside block\n*/\nret';
    render(<CodeEditor {...defaults} value={value} language="asm" target="aarch64" />);
    const view = currentView();
    const tree = ensureSyntaxTree(view.state, value.length, 100)!;
    const comments: string[] = [];
    tree.iterate({
      enter(node) {
        if (node.name === "comment") comments.push(value.slice(node.from, node.to));
      },
    });
    expect(comments).toContain("// line");
    expect(comments.join("\n")).toContain("// inside block");
    expect(comments.join("\n")).not.toContain("#1");
    expect(comments.join("\n")).not.toContain("// string");
  });
});
