import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, indentUnit } from "@codemirror/language";
import { search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import type { Language, TargetId } from "@qemu-playground/shared";
import { minimalSetup } from "codemirror";
import { useLayoutEffect, useRef } from "react";
import { editorLanguage } from "../editor/languages";
import { editorTheme } from "../editor/theme";

export interface CodeEditorProps {
  value: string;
  language: Language;
  target: TargetId;
  readOnly?: boolean;
  ariaLabel: string;
  onChange?: (value: string) => void;
}

function interaction({ readOnly = false, ariaLabel }: CodeEditorProps) {
  return [
    EditorState.readOnly.of(readOnly),
    EditorView.editable.of(!readOnly),
    EditorView.contentAttributes.of({
      "aria-label": ariaLabel,
      "aria-readonly": String(readOnly),
      tabindex: "0",
    }),
  ];
}

const editing = [
  keymap.of([...closeBracketsKeymap, ...searchKeymap, indentWithTab]),
  minimalSetup,
  lineNumbers(),
  search({ top: true }),
  bracketMatching(),
  closeBrackets(),
  indentOnInput(),
  indentUnit.of("    "),
  EditorState.tabSize.of(4),
  editorTheme,
];

export function CodeEditor(props: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const editorRef = useRef<{
    view: EditorView;
    language: Compartment;
    interaction: Compartment;
    createState: (props: CodeEditorProps) => EditorState;
    props: CodeEditorProps;
  } | null>(null);

  useLayoutEffect(() => {
    latest.current = props;
  });

  useLayoutEffect(() => {
    const language = new Compartment();
    const access = new Compartment();
    const createState = (current: CodeEditorProps) =>
      EditorState.create({
        doc: current.value,
        extensions: [
          editing,
          language.of(editorLanguage(current.language, current.target)),
          access.of(interaction(current)),
          EditorView.updateListener.of((update) => {
            if (update.docChanged) latest.current.onChange?.(update.state.doc.toString());
          }),
        ],
      });
    const view = new EditorView({
      parent: containerRef.current!,
      state: createState(latest.current),
    });
    editorRef.current = {
      view,
      language,
      interaction: access,
      createState,
      props: latest.current,
    };
    return () => {
      view.destroy();
      editorRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const editor = editorRef.current!;
    const { view } = editor;
    if (view.state.doc.toString() !== props.value) {
      // An external replacement starts a new document, without notifying onChange.
      // setState clears history and selection while keeping the EditorView alive.
      view.setState(editor.createState(props));
      view.scrollDOM.scrollTop = 0;
      view.scrollDOM.scrollLeft = 0;
    } else {
      const effects = [];
      if (editor.props.language !== props.language || editor.props.target !== props.target) {
        effects.push(editor.language.reconfigure(editorLanguage(props.language, props.target)));
      }
      if (editor.props.readOnly !== props.readOnly || editor.props.ariaLabel !== props.ariaLabel) {
        effects.push(editor.interaction.reconfigure(interaction(props)));
      }
      if (effects.length > 0) view.dispatch({ effects });
    }
    editor.props = props;
  }, [props]);

  return <div className="editor-shell__surface" ref={containerRef} />;
}
