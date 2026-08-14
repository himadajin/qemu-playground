import type * as Monaco from "monaco-editor/editor/editor.api";
import { useEffect, useRef, useState } from "react";
import { ASM_LANGUAGE_ID } from "../editor/asmLanguage";
import { loadMonaco } from "../editor/monacoLoader";
import type { MonacoApi } from "../editor/monacoSetup";
import type { Language } from "@qemu-playground/shared";

interface CodeEditorProps {
  value: string;
  language: Language;
  readOnly?: boolean;
  ariaLabel: string;
  onChange?: (value: string) => void;
}

function monacoLanguageId(language: Language): string {
  return language === "c" ? "c" : ASM_LANGUAGE_ID;
}

const EDITOR_OPTIONS: Monaco.editor.IStandaloneEditorConstructionOptions = {
  automaticLayout: true,
  minimap: { enabled: false },
  scrollBeyondLastLine: false,
  fontFamily: '"Geist Mono Variable", ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  fontSize: 13,
  lineHeight: 20,
  tabSize: 4,
  insertSpaces: true,
  renderWhitespace: "selection",
  scrollbar: { useShadows: false },
  overviewRulerBorder: false,
  padding: { top: 8, bottom: 8 },
  fixedOverflowWidgets: true,
  theme: "vs",
};

/**
 * Monaco wrapper. The shell around it keeps its size from the first paint, so
 * the editor appearing does not move the rest of the layout; only the
 * skeleton inside the shell is swapped out.
 */
export function CodeEditor({
  value,
  language,
  readOnly = false,
  ariaLabel,
  onChange,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<Monaco.editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<MonacoApi | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "failed">("loading");

  // Read through refs inside the one-shot creation effect so that a value or
  // language change does not tear the editor down and rebuild it. The sync
  // runs in an effect (not during render) so only committed renders update
  // it; nothing reads `latest.current` synchronously during render.
  const latest = useRef({ value, language, readOnly, onChange });
  useEffect(() => {
    latest.current = { value, language, readOnly, onChange };
  });

  useEffect(() => {
    let cancelled = false;

    void loadMonaco().then(
      (monaco) => {
        const container = containerRef.current;
        if (cancelled || container === null) {
          return;
        }
        monacoRef.current = monaco;
        const editor = monaco.editor.create(container, {
          ...EDITOR_OPTIONS,
          value: latest.current.value,
          language: monacoLanguageId(latest.current.language),
          readOnly: latest.current.readOnly,
          ariaLabel,
        });
        editor.onDidChangeModelContent(() => {
          latest.current.onChange?.(editor.getValue());
        });
        editorRef.current = editor;
        setStatus("ready");
      },
      () => {
        if (!cancelled) {
          setStatus("failed");
        }
      },
    );

    return () => {
      cancelled = true;
      editorRef.current?.getModel()?.dispose();
      editorRef.current?.dispose();
      editorRef.current = null;
    };
  }, [ariaLabel]);

  useEffect(() => {
    const editor = editorRef.current;
    if (editor !== null && editor.getValue() !== value) {
      editor.setValue(value);
    }
  }, [value, status]);

  useEffect(() => {
    const monaco = monacoRef.current;
    const model = editorRef.current?.getModel();
    if (monaco !== null && model != null) {
      monaco.editor.setModelLanguage(model, monacoLanguageId(language));
    }
  }, [language, status]);

  useEffect(() => {
    editorRef.current?.updateOptions({ readOnly });
  }, [readOnly, status]);

  return (
    <div className="editor-shell">
      <div className="editor-shell__surface" ref={containerRef} />
      {status !== "ready" && (
        <div className="editor-shell__overlay" aria-hidden="true">
          {status === "loading" ? (
            <div className="editor-skeleton">
              <span className="editor-skeleton__line editor-skeleton__line--lg" />
              <span className="editor-skeleton__line editor-skeleton__line--md" />
              <span className="editor-skeleton__line editor-skeleton__line--sm" />
              <span className="editor-skeleton__line editor-skeleton__line--md" />
            </div>
          ) : (
            <p className="editor-shell__message">
              The editor could not be loaded. Reload the page to try again.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
