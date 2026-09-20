import { Alert, Button, useComputedColorScheme } from "@mantine/core";
import { IconPlayerPlay } from "@tabler/icons-react";
import { useEffect, useState } from "react";
import { useMediaQuery } from "@mantine/hooks";
import { LazyCodeEditor } from "./components/LazyCodeEditor";
import type { EditorSessions } from "./components/CodeEditor";
import { FileSidebar } from "./components/FileSidebar";
import { FileDialog, type FileDraft, type FileDialogSubmission } from "./components/FileDialog";
import { Toolbar } from "./components/Toolbar";
import { FileSettings } from "./components/FileSettings";
import { PreviewBanner } from "./components/PreviewBanner";
import { ProgramResult } from "./components/ProgramResult";
import { ProgramLayout } from "./components/ProgramLayout";
import { ConfirmDiscardDialog } from "./components/ConfirmDiscardDialog";
import { useProgramWorkspace } from "./hooks/useProgramWorkspace";
import { useProgramExecution } from "./hooks/useProgramExecution";
import { useProgramShare } from "./hooks/useProgramShare";
import { createFile, downloadFile, uniqueName, type ProgramFile } from "./lib/files";

export function App() {
  const workspace = useProgramWorkspace();
  const { collection, preview, previewSelected, active, storageError, updateActive } = workspace;
  const executionState = useProgramExecution();
  const { executions, runningId } = executionState;
  const sharing = useProgramShare();
  const [sessions] = useState<EditorSessions>(() => new Map());
  const [mainTab, setMainTab] = useState<"code" | "result">("code");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<FileDraft | null>(null);
  const [deleting, setDeleting] = useState<ProgramFile | null>(null);
  const [closingPreview, setClosingPreview] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const narrow = useMediaQuery("(max-width: 1080px)", undefined, {
    getInitialValueInEffect: false,
  });
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: false });
  const execution = active ? executions[active.id] : undefined;
  const ownRunning = !!active && runningId === active.id;
  const runningFile = [...collection.files, ...(preview ? [preview] : [])].find(
    (file) => file.id === runningId,
  );

  useEffect(() => {
    const live = new Set(collection.files.map((file) => file.id));
    if (preview) live.add(preview.id);
    for (const id of sessions.keys()) if (!live.has(id)) sessions.delete(id);
  }, [collection.files, preview, sessions]);

  function showCode() {
    setDrawerOpen(false);
    setMainTab("code");
  }
  function select(id: string) {
    workspace.select(id);
    showCode();
  }
  function add(file: ProgramFile) {
    workspace.add(file);
    showCode();
  }
  function newFile() {
    setDrawerOpen(false);
    const file = createFile();
    file.name = uniqueName("untitled", "c", collection.files);
    setDraft({ mode: "new", file });
  }
  function submitDraft(submission: FileDialogSubmission) {
    if (!draft || draft.mode !== submission.mode) return;
    switch (submission.mode) {
      case "new":
        add(
          submission.programType === "c"
            ? createFile("c", "rv64", submission.name)
            : createFile("asm", submission.programType, submission.name),
        );
        break;
      case "rename":
        workspace.renameFile(draft.file.id, submission.name);
        break;
      case "import":
        add({
          ...draft.file,
          name: submission.name,
          target: submission.target ?? draft.file.target,
        });
        break;
      case "add":
        if (!preview || preview.id !== draft.file.id) return;
        workspace.savePreview(submission.name);
        showCode();
        break;
    }
    setDraft(null);
  }
  function releaseFile(id: string) {
    sessions.delete(id);
    executionState.forget(id);
  }
  function closePreview() {
    if (!preview || executionState.isRunning(preview.id)) return;
    workspace.closePreview();
    releaseFile(preview.id);
    setClosingPreview(false);
  }
  function deleteFile() {
    if (!deleting || executionState.isRunning(deleting.id)) return;
    workspace.deleteFile(deleting.id);
    releaseFile(deleting.id);
    setDeleting(null);
  }
  function run() {
    if (active && executionState.run(active)) setMainTab("result");
  }
  async function importSource(file: File) {
    setDrawerOpen(false);
    if (!/\.(c|s)$/i.test(file.name)) {
      setImportError("Choose a .c or .s source file.");
      return;
    }
    try {
      const language = /\.c$/i.test(file.name) ? "c" : "asm";
      const imported = {
        ...createFile(language),
        code: await file.text(),
        name: uniqueName(file.name, language, collection.files),
      };
      setDraft({ mode: "import", file: imported });
      setImportError(null);
    } catch {
      setImportError("This file could not be read. Try importing it again.");
    }
  }
  const sidebar = (
    <FileSidebar
      files={collection.files}
      selectedId={active?.id ?? null}
      runningId={runningId}
      preview={preview}
      onSelect={select}
      onReorder={workspace.reorder}
      onAction={(action, file) => {
        if (action === "rename") setDraft({ mode: "rename", file });
        if (action === "duplicate") {
          workspace.duplicateFile(file.id);
          showCode();
        }
        if (action === "download") downloadFile(file);
        if (action === "delete" && !executionState.isRunning(file.id)) setDeleting(file);
      }}
    />
  );
  const runButton = (
    <Button
      size="xs"
      leftSection={<IconPlayerPlay size={13} />}
      disabled={!active || runningId !== null}
      aria-busy={ownRunning}
      onClick={() => void run()}
    >
      {ownRunning ? "Running…" : "Run"}
    </Button>
  );
  const editor = active && (
    <>
      {previewSelected && (
        <PreviewBanner
          running={ownRunning}
          onSave={() =>
            setDraft({
              mode: "add",
              file: {
                ...active,
                name: uniqueName(active.name, active.language, collection.files),
              },
            })
          }
          onClose={() => {
            if (workspace.previewEdited) setClosingPreview(true);
            else closePreview();
          }}
        />
      )}
      <FileSettings file={active} onChange={updateActive} />
      <LazyCodeEditor
        fileId={active.id}
        sessions={sessions}
        value={active.code}
        language={active.language}
        target={active.target}
        colorScheme={colorScheme}
        ariaLabel="Source code"
        onChange={(code) => updateActive({ code })}
      />
    </>
  );
  const result = active && (
    <ProgramResult
      key={active.id}
      file={active}
      execution={execution}
      runningId={runningId}
      runningFile={runningFile}
      colorScheme={colorScheme}
      runButton={!narrow && runButton}
      scrollPositions={executionState.scrollPositions}
      onToggle={(runId) => executionState.toggle(active.id, runId)}
      onClear={() => executionState.clear(active.id)}
    />
  );
  return (
    <div className="app">
      <Toolbar
        onShare={() => {
          if (active) sharing.share(active);
        }}
        disabled={!active}
        notice={sharing.notice}
        onDismiss={sharing.dismiss}
      />
      {storageError && (
        <Alert color="red" p="xs">
          {storageError}
        </Alert>
      )}
      {importError && (
        <Alert color="red" p="xs" withCloseButton onClose={() => setImportError(null)}>
          {importError}
        </Alert>
      )}
      <ProgramLayout
        narrow={!!narrow}
        sidebarOpen={collection.sidebarOpen}
        drawerOpen={drawerOpen}
        hasActive={!!active}
        mainTab={mainTab}
        otherRunningName={runningId && !ownRunning ? (runningFile?.name ?? "another file") : null}
        sidebar={sidebar}
        editor={editor}
        result={result}
        runButton={runButton}
        onToggleSidebar={() => {
          if (narrow) setDrawerOpen(true);
          else workspace.toggleSidebar();
        }}
        onCloseDrawer={() => setDrawerOpen(false)}
        onTabChange={setMainTab}
        onNew={newFile}
        onImport={(file) => void importSource(file)}
      />
      {draft && (
        <FileDialog
          key={draft.file.id + draft.mode}
          draft={draft}
          files={collection.files}
          onClose={() => setDraft(null)}
          onSubmit={submitDraft}
        />
      )}
      <ConfirmDiscardDialog
        opened={!!deleting}
        title="Delete file"
        cancelLabel="Cancel"
        confirmLabel="Delete"
        disabled={deleting?.id === runningId}
        onClose={() => setDeleting(null)}
        onConfirm={deleteFile}
      >
        Delete “{deleting?.name}”? This cannot be undone.
      </ConfirmDiscardDialog>
      <ConfirmDiscardDialog
        opened={closingPreview}
        title="Close shared preview"
        cancelLabel="Keep editing"
        confirmLabel="Discard preview"
        disabled={preview?.id === runningId}
        onClose={() => setClosingPreview(false)}
        onConfirm={closePreview}
      >
        Discard changes to “{preview?.name}”? Add it to your files to keep your edits.
      </ConfirmDiscardDialog>
    </div>
  );
}
