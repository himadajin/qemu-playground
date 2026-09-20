import { closeBrackets, closeBracketsKeymap } from "@codemirror/autocomplete";
import { indentWithTab } from "@codemirror/commands";
import { bracketMatching, indentOnInput, indentUnit } from "@codemirror/language";
import { openSearchPanel, search, searchKeymap } from "@codemirror/search";
import { Compartment, EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import type { Language, TargetId } from "@qemu-playground/shared";
import { minimalSetup } from "codemirror";
import { useLayoutEffect, useRef } from "react";
import { editorLanguage } from "../editor/languages";
import { editorTheme, type EditorColorScheme } from "../editor/theme";

export type EditorSessions = Map<string, { state: EditorState; top: number; left: number }>;
const language = new Compartment();
const theme = new Compartment();
const access = new Compartment();
const listener = new Compartment();

export interface CodeEditorProps {
  fileId?: string;
  sessions?: EditorSessions;
  value: string;
  language: Language;
  target: TargetId;
  colorScheme?: EditorColorScheme;
  readOnly?: boolean;
  ariaLabel: string;
  onChange?: (value: string) => void;
  searchRequest?: number;
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
];

export function CodeEditor(props: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const editorRef = useRef<{
    view: EditorView;
    language: Compartment;
    theme: Compartment;
    interaction: Compartment;
    createState: (props: CodeEditorProps) => EditorState;
    props: CodeEditorProps;
  } | null>(null);

  useLayoutEffect(() => {
    latest.current = props;
  });

  useLayoutEffect(() => {
    const createState = (current: CodeEditorProps) =>
      EditorState.create({
        doc: current.value,
        extensions: [
          editing,
          language.of(editorLanguage(current.language, current.target)),
          theme.of(editorTheme(current.colorScheme ?? "light")),
          access.of(interaction(current)),
          listener.of(
            EditorView.updateListener.of((update) => {
              if (update.docChanged) latest.current.onChange?.(update.state.doc.toString());
            }),
          ),
        ],
      });
    const cached = latest.current.fileId
      ? latest.current.sessions?.get(latest.current.fileId)
      : undefined;
    const view = new EditorView({
      parent: containerRef.current!,
      state: cached?.state ?? createState(latest.current),
    });
    if (cached) {
      view.dispatch({
        effects: [
          language.reconfigure(editorLanguage(latest.current.language, latest.current.target)),
          theme.reconfigure(editorTheme(latest.current.colorScheme ?? "light")),
          access.reconfigure(interaction(latest.current)),
          listener.reconfigure(
            EditorView.updateListener.of((update) => {
              if (update.docChanged) latest.current.onChange?.(update.state.doc.toString());
            }),
          ),
        ],
      });
      view.scrollDOM.scrollTop = cached.top;
      view.scrollDOM.scrollLeft = cached.left;
    }
    editorRef.current = {
      view,
      language,
      theme,
      interaction: access,
      createState,
      props: latest.current,
    };
    return () => {
      const previous = editorRef.current?.props;
      if (previous?.fileId)
        previous.sessions?.set(previous.fileId, {
          state: view.state,
          top: view.scrollDOM.scrollTop,
          left: view.scrollDOM.scrollLeft,
        });
      view.destroy();
      editorRef.current = null;
    };
  }, []);

  useLayoutEffect(() => {
    const editor = editorRef.current!;
    const { view } = editor;
    if (editor.props.fileId !== props.fileId) {
      const previous = editor.props;
      if (previous.fileId)
        previous.sessions?.set(previous.fileId, {
          state: view.state,
          top: view.scrollDOM.scrollTop,
          left: view.scrollDOM.scrollLeft,
        });
      const cached = props.fileId ? props.sessions?.get(props.fileId) : undefined;
      view.setState(
        cached?.state.doc.toString() === props.value ? cached.state : editor.createState(props),
      );
      view.dispatch({
        effects: [
          language.reconfigure(editorLanguage(props.language, props.target)),
          theme.reconfigure(editorTheme(props.colorScheme ?? "light")),
          access.reconfigure(interaction(props)),
          listener.reconfigure(
            EditorView.updateListener.of((update) => {
              if (update.docChanged) latest.current.onChange?.(update.state.doc.toString());
            }),
          ),
        ],
      });
      view.scrollDOM.scrollTop = cached?.top ?? 0;
      view.scrollDOM.scrollLeft = cached?.left ?? 0;
    } else if (view.state.doc.toString() !== props.value) {
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
      if (editor.props.colorScheme !== props.colorScheme) {
        effects.push(editor.theme.reconfigure(editorTheme(props.colorScheme ?? "light")));
      }
      if (editor.props.readOnly !== props.readOnly || editor.props.ariaLabel !== props.ariaLabel) {
        effects.push(editor.interaction.reconfigure(interaction(props)));
      }
      if (effects.length > 0) view.dispatch({ effects });
    }
    editor.props = props;
  }, [props]);

  useLayoutEffect(() => {
    if (props.searchRequest) openSearchPanel(editorRef.current!.view);
  }, [props.searchRequest]);

  return <div className="editor-shell__surface" ref={containerRef} />;
}
