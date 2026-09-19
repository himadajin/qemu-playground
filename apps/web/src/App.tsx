import {
  TARGETS,
  getTargetDefinition,
  type RunResult,
  type TargetId,
} from "@qemu-playground/shared";
import {
  ActionIcon,
  Alert,
  Button,
  Drawer,
  Group,
  Modal,
  NativeSelect,
  Tabs,
  Text,
  TextInput,
  useComputedColorScheme,
} from "@mantine/core";
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconPlayerPlay,
  IconX,
} from "@tabler/icons-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useClipboard, useMediaQuery } from "@mantine/hooks";
import { ResizableWorkspace } from "./components/ResizableWorkspace";
import { LazyCodeEditor } from "./components/LazyCodeEditor";
import type { EditorSessions } from "./components/CodeEditor";
import { ResultPane, type ResultTab } from "./components/ResultPane";
import { FileSidebar } from "./components/FileSidebar";
import { FileDialog, type FileDraft } from "./components/FileDialog";
import { Toolbar, type ToolbarNotice } from "./components/Toolbar";
import { requestRun } from "./lib/runApi";
import { deriveResultView } from "./lib/runView";
import { getSample } from "./lib/samples";
import { buildShareUrl, readShareStateFromHash, type ShareState } from "./lib/share";
import {
  createFile,
  downloadFile,
  loadFiles,
  persistFiles,
  sameProgram,
  uniqueName,
  type FileCollection,
  type ProgramFile,
} from "./lib/files";

interface Execution {
  result?: RunResult;
  input?: ShareState;
  error?: string;
  tab: ResultTab;
}
function initialCollection() {
  try {
    return { collection: loadFiles(window.localStorage), error: null };
  } catch {
    return {
      collection: { files: [], selectedId: null, sidebarOpen: true } satisfies FileCollection,
      error:
        "Saved files could not be read. Reload to try again. Existing browser data has not been replaced.",
    };
  }
}
export function App() {
  const initial = useMemo(initialCollection, []);
  const [collection, setCollection] = useState<FileCollection>(initial.collection);
  const shared = useMemo(() => readShareStateFromHash(window.location.hash), []);
  const [preview, setPreview] = useState<ProgramFile | null>(() =>
    shared
      ? {
          ...shared,
          id: crypto.randomUUID(),
          name: shared.language === "c" ? "shared.c" : "shared.s",
        }
      : null,
  );
  const [previewSelected, setPreviewSelected] = useState(!!shared);
  const [executions, setExecutions] = useState<Record<string, Execution>>({});
  const [runningId, setRunningId] = useState<string | null>(null);
  const inFlight = useRef<string | null>(null);
  const sessions = useRef<EditorSessions>(new Map());
  const [mainTab, setMainTab] = useState<"code" | "result">("code");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [draft, setDraft] = useState<FileDraft | null>(null);
  const [deleting, setDeleting] = useState<ProgramFile | null>(null);
  const [closingPreview, setClosingPreview] = useState(false);
  const [storageError, setStorageError] = useState<string | null>(initial.error);
  const [importError, setImportError] = useState<string | null>(null);
  const [shareNotice, setShareNotice] = useState<ToolbarNotice | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const {
    copy,
    copied,
    error: clipboardError,
    reset: resetClipboard,
  } = useClipboard({ timeout: 2000 });
  const narrow = useMediaQuery("(max-width: 1080px)", undefined, {
    getInitialValueInEffect: false,
  });
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: false });
  const active =
    previewSelected && preview
      ? preview
      : collection.files.find((file) => file.id === collection.selectedId);
  const execution = active ? executions[active.id] : undefined;
  const ownRunning = !!active && runningId === active.id;
  const runningFile = [...collection.files, ...(preview ? [preview] : [])].find(
    (file) => file.id === runningId,
  );

  useEffect(() => {
    if (initial.error) return;
    let error: string | null = null;
    try {
      persistFiles(window.localStorage, collection);
    } catch {
      error = "Changes could not be saved in this browser. Download your files to keep a copy.";
    }
    let disposed = false;
    queueMicrotask(() => {
      if (!disposed) setStorageError(error);
    });
    return () => {
      disposed = true;
    };
  }, [collection, initial.error]);

  useEffect(() => {
    const live = new Set(collection.files.map((file) => file.id));
    if (preview) live.add(preview.id);
    for (const id of sessions.current.keys()) if (!live.has(id)) sessions.current.delete(id);
  }, [collection.files, preview]);

  function updateActive(patch: Partial<Pick<ProgramFile, "code" | "target" | "compileOptions">>) {
    if (!active) return;
    if (previewSelected) setPreview((current) => (current ? { ...current, ...patch } : current));
    else
      setCollection((current) => ({
        ...current,
        files: current.files.map((file) => (file.id === active.id ? { ...file, ...patch } : file)),
      }));
  }
  function select(id: string) {
    setPreviewSelected(id === preview?.id);
    if (id !== preview?.id) setCollection((current) => ({ ...current, selectedId: id }));
    setDrawerOpen(false);
    setMainTab("code");
  }
  function add(file: ProgramFile) {
    setCollection((current) => ({
      ...current,
      files: [...current.files, file],
      selectedId: file.id,
    }));
    setPreviewSelected(false);
    setDrawerOpen(false);
    setMainTab("code");
  }
  function newFile() {
    setDrawerOpen(false);
    const file = createFile();
    file.name = uniqueName("untitled", "c", collection.files);
    setDraft({ mode: "new", file });
  }
  function submitDraft(file: ProgramFile) {
    if (!draft) return;
    if (draft.mode === "rename")
      setCollection((current) => ({
        ...current,
        files: current.files.map((item) =>
          item.id === file.id ? { ...item, name: file.name } : item,
        ),
      }));
    else {
      add(draft.mode === "new" ? { ...file, code: getSample(file.language, file.target) } : file);
      if (draft.mode === "add") {
        setPreview(null);
        clearHash();
      }
    }
    setDraft(null);
  }
  function clearHash() {
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }
  function closePreview() {
    if (!preview || inFlight.current === preview.id) return;
    sessions.current.delete(preview.id);
    setExecutions((current) => {
      const next = { ...current };
      delete next[preview.id];
      return next;
    });
    setPreview(null);
    setPreviewSelected(false);
    setClosingPreview(false);
    clearHash();
  }
  async function run() {
    if (!active || inFlight.current) return;
    const file = active;
    const input: ShareState = {
      language: file.language,
      target: file.target,
      code: file.code,
      compileOptions: file.compileOptions,
    };
    inFlight.current = file.id;
    setRunningId(file.id);
    setExecutions((current) => ({
      ...current,
      [file.id]: { ...current[file.id], error: undefined, tab: "output" },
    }));
    setMainTab("result");
    try {
      const outcome = await requestRun(input);
      setExecutions((current) => ({
        ...current,
        [file.id]: outcome.ok
          ? { result: outcome.result, input, tab: current[file.id]?.tab ?? "output" }
          : { ...current[file.id], error: outcome.message, tab: current[file.id]?.tab ?? "output" },
      }));
    } catch {
      setExecutions((current) => ({
        ...current,
        [file.id]: {
          ...current[file.id],
          error: "The Run could not be completed. Try again.",
          tab: "output",
        },
      }));
    } finally {
      inFlight.current = null;
      setRunningId(null);
    }
  }
  function share() {
    if (!active) return;
    resetClipboard();
    setShareNotice(null);
    const built = buildShareUrl(window.location.href, active);
    if (!built.ok) {
      setShareNotice({
        tone: "error",
        text: `Too long to share: ${built.length} of ${built.limit} characters. Shorten the code.`,
      });
      return;
    }
    window.history.replaceState(null, "", built.url);
    copy(built.url);
  }
  const sidebar = (
    <FileSidebar
      files={collection.files}
      selectedId={active?.id ?? null}
      runningId={runningId}
      preview={preview}
      onSelect={select}
      onNew={newFile}
      onImport={() => {
        setDrawerOpen(false);
        fileInput.current?.click();
      }}
      onReorder={(files) => setCollection((current) => ({ ...current, files }))}
      onAction={(action, file) => {
        if (action === "rename") setDraft({ mode: "rename", file });
        if (action === "duplicate")
          add({
            ...file,
            id: crypto.randomUUID(),
            name: uniqueName(`${file.name.slice(0, -2)}-copy`, file.language, collection.files),
          });
        if (action === "download") downloadFile(file);
        if (action === "delete" && inFlight.current !== file.id) setDeleting(file);
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
  const view = deriveResultView(
    execution?.result
      ? { kind: "result", result: execution.result }
      : ownRunning
        ? { kind: "running" }
        : execution?.error
          ? { kind: "failed", message: execution.error }
          : { kind: "idle" },
    active?.language ?? "c",
  );
  const stale = !!active && !!execution?.input && !sameProgram(active, execution.input);
  const editor = active && (
    <>
      {previewSelected && (
        <div className="preview-banner">
          <div>
            <strong>Shared preview</strong>
            <span>Not saved in your files</span>
          </div>
          <Button
            size="xs"
            variant="default"
            onClick={() =>
              setDraft({
                mode: "add",
                file: {
                  ...active,
                  name: uniqueName(active.name, active.language, collection.files),
                },
              })
            }
          >
            Add to files
          </Button>
          <ActionIcon
            variant="subtle"
            color="gray"
            aria-label="Close preview"
            disabled={ownRunning}
            onClick={() => {
              if (shared && !sameProgram(active, shared)) setClosingPreview(true);
              else closePreview();
            }}
          >
            <IconX size={15} />
          </ActionIcon>
        </div>
      )}
      <div className="file-settings">
        <span className="file-settings__name" title={active.name}>
          {active.name}
        </span>
        {active.language === "c" ? (
          <NativeSelect
            size="xs"
            aria-label="Target"
            value={active.target}
            data={TARGETS.map((item) => ({ value: item.id, label: item.displayName }))}
            onChange={(event) => updateActive({ target: event.currentTarget.value as TargetId })}
          />
        ) : (
          <Text size="xs" c="dimmed">
            {getTargetDefinition(active.target).displayName}
          </Text>
        )}
        <TextInput
          className="file-settings__options"
          size="xs"
          aria-label="Compile options"
          placeholder="-O2"
          spellCheck={false}
          autoComplete="off"
          value={active.compileOptions}
          onChange={(event) => updateActive({ compileOptions: event.currentTarget.value })}
        />
      </div>
      <LazyCodeEditor
        fileId={active.id}
        sessions={sessions.current}
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
    <>
      <div className="execution-heading">
        <div className="execution-heading__context">
          <strong title={active.name}>{active.name}</strong>
          <span>{getTargetDefinition(active.target).displayName}</span>
        </div>
        {!narrow && runButton}
      </div>
      {runningId && (
        <div className="execution-note" role="status">
          {ownRunning
            ? execution?.result
              ? "Running… Showing output from the previous run."
              : "Running…"
            : `Running ${runningFile?.name ?? "another file"}…`}
        </div>
      )}
      {execution?.input && (
        <div className="execution-snapshot">
          <span>
            {stale ? "Out of date · " : ""}Last run:{" "}
            {getTargetDefinition(execution.input.target).displayName}
          </span>
          <details>
            <summary>Run settings</summary>
            <div>
              Compiler options: <code>{execution.input.compileOptions || "default"}</code>
            </div>
          </details>
        </div>
      )}
      {execution?.error && execution.result && (
        <Alert color="red" variant="light" p="xs">
          {execution.error} Showing output from the previous run.
        </Alert>
      )}
      <ResultPane
        view={ownRunning ? { ...view, badge: "running" } : view}
        tab={execution?.tab ?? "output"}
        onTabChange={(tab) =>
          setExecutions((current) => ({ ...current, [active.id]: { ...current[active.id], tab } }))
        }
        language={active.language}
        target={execution?.input?.target ?? active.target}
        colorScheme={colorScheme}
      />
    </>
  );
  return (
    <div className="app">
      <Toolbar
        onShare={share}
        disabled={!active}
        notice={
          shareNotice ??
          (clipboardError
            ? { tone: "error", text: "Could not copy the link. Copy the URL from the address bar." }
            : copied
              ? { tone: "info", text: "Share URL copied to clipboard." }
              : null)
        }
        onDismiss={() => {
          setShareNotice(null);
          resetClipboard();
        }}
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
      <div className="workbench">
        {!narrow && collection.sidebarOpen && <aside className="sidebar">{sidebar}</aside>}
        <div className="workbench__main">
          <div className="workbench__navigation">
            <ActionIcon
              variant="subtle"
              color="gray"
              aria-label={narrow || !collection.sidebarOpen ? "Show files" : "Hide files"}
              onClick={() => {
                if (narrow) setDrawerOpen(true);
                else
                  setCollection((current) => ({ ...current, sidebarOpen: !current.sidebarOpen }));
              }}
            >
              {!narrow && collection.sidebarOpen ? (
                <IconLayoutSidebarLeftCollapse size={18} />
              ) : (
                <IconLayoutSidebarLeftExpand size={18} />
              )}
            </ActionIcon>
            <Text size="xs" c="dimmed">
              {previewSelected ? "Shared preview" : "Independent programs"}
            </Text>
          </div>
          {!active ? (
            <main className="empty-workspace">
              <Text fw={500}>Start with a program</Text>
              <Text size="sm" c="dimmed">
                Create a C or assembly file to begin.
              </Text>
              <Group gap="xs">
                <Button size="xs" onClick={newFile}>
                  New file
                </Button>
                <Button size="xs" variant="default" onClick={() => fileInput.current?.click()}>
                  Import source
                </Button>
              </Group>
            </main>
          ) : narrow ? (
            <Tabs
              className="workspace workspace--stacked"
              value={mainTab}
              onChange={(value) => {
                if (value) setMainTab(value as "code" | "result");
              }}
              keepMounted
              keepMountedMode="display-none"
            >
              <div className="mobile-run-bar">
                <Tabs.List aria-label="Workspace">
                  <Tabs.Tab value="code">Code</Tabs.Tab>
                  <Tabs.Tab value="result">Result</Tabs.Tab>
                </Tabs.List>
                {runningId && !ownRunning && (
                  <span className="mobile-run-bar__status" role="status">
                    Running {runningFile?.name ?? "another file"}…
                  </span>
                )}
                {runButton}
              </div>
              <Tabs.Panel className="workspace__panel" value="code">
                {editor}
              </Tabs.Panel>
              <Tabs.Panel className="workspace__panel" value="result">
                {result}
              </Tabs.Panel>
            </Tabs>
          ) : (
            <ResizableWorkspace code={editor} result={result} />
          )}
        </div>
      </div>
      <Drawer
        opened={!!narrow && drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title="Your programs"
        size={280}
        styles={{ body: { height: "calc(100% - 64px)", padding: 0 } }}
      >
        {sidebar}
      </Drawer>
      <input
        ref={fileInput}
        type="file"
        accept=".c,.s"
        hidden
        aria-label="Import source file"
        onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (!file) return;
          if (!/\.(c|s)$/i.test(file.name)) {
            setImportError("Choose a .c or .s source file.");
            return;
          }
          void (async () => {
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
          })();
        }}
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
      <Modal
        opened={!!deleting}
        onClose={() => setDeleting(null)}
        title="Delete file"
        centered
        size="sm"
      >
        <Text size="sm">Delete “{deleting?.name}”? This cannot be undone.</Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setDeleting(null)}>
            Cancel
          </Button>
          <Button
            color="red"
            disabled={deleting?.id === runningId}
            onClick={() => {
              if (!deleting || inFlight.current === deleting.id) return;
              const id = deleting.id;
              setCollection((current) => {
                const index = current.files.findIndex((file) => file.id === id);
                const files = current.files.filter((file) => file.id !== id);
                return {
                  ...current,
                  files,
                  selectedId:
                    current.selectedId === id
                      ? (files[Math.min(index, files.length - 1)]?.id ?? null)
                      : current.selectedId,
                };
              });
              sessions.current.delete(id);
              setExecutions((current) => {
                const next = { ...current };
                delete next[id];
                return next;
              });
              setDeleting(null);
            }}
          >
            Delete
          </Button>
        </Group>
      </Modal>
      <Modal
        opened={closingPreview}
        onClose={() => setClosingPreview(false)}
        title="Close shared preview"
        centered
        size="sm"
      >
        <Text size="sm">
          Discard changes to “{preview?.name}”? Add it to your files to keep your edits.
        </Text>
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => setClosingPreview(false)}>
            Keep editing
          </Button>
          <Button color="red" disabled={preview?.id === runningId} onClick={closePreview}>
            Discard preview
          </Button>
        </Group>
      </Modal>
    </div>
  );
}
