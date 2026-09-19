import { Skeleton, Stack } from "@mantine/core";
import { Component, lazy, Suspense } from "react";
import type { ReactNode } from "react";
import type { CodeEditorProps } from "./CodeEditor";

const Editor = lazy(() =>
  import("./CodeEditor").then(({ CodeEditor }) => ({ default: CodeEditor })),
);

class EditorErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    return this.state.failed ? (
      <div className="editor-shell__overlay">
        <p className="editor-shell__message" role="alert">
          The editor could not be loaded. Reload the page to try again.
        </p>
      </div>
    ) : (
      this.props.children
    );
  }
}

function EditorPlaceholder() {
  return (
    <div className="editor-shell__overlay" aria-busy="true">
      <Stack gap="sm" w="100%" aria-label="Loading editor" role="status">
        <Skeleton height={10} width="46%" />
        <Skeleton height={10} width="32%" />
        <Skeleton height={10} width="18%" />
        <Skeleton height={10} width="32%" />
      </Stack>
    </div>
  );
}

export function LazyCodeEditor(props: CodeEditorProps) {
  return (
    <div className="editor-shell">
      <EditorErrorBoundary>
        <Suspense fallback={<EditorPlaceholder />}>
          <Editor {...props} />
        </Suspense>
      </EditorErrorBoundary>
    </div>
  );
}
