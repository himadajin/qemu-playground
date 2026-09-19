import type { Language, TargetId } from "@qemu-playground/shared";
import { Tabs, useComputedColorScheme } from "@mantine/core";
import { useCallback, useMemo, useRef, useState } from "react";
import { ResizableWorkspace } from "./components/ResizableWorkspace";
import { LazyCodeEditor } from "./components/LazyCodeEditor";
import { ResultPane, type ResultTab } from "./components/ResultPane";
import { OpenDialog, SaveDialog } from "./components/SnippetDialogs";
import { Toolbar, type ToolbarNotice } from "./components/Toolbar";
import { useClipboard, useMediaQuery } from "@mantine/hooks";
import { requestRun } from "./lib/runApi";
import { deriveResultView, type RunPhase } from "./lib/runView";
import { DEFAULT_LANGUAGE, DEFAULT_TARGET, getSample, isUntouchedSample } from "./lib/samples";
import { buildShareUrl, readShareStateFromHash, type ShareState } from "./lib/share";
import { deleteSnippet, loadSnippets, saveSnippet, type SavedSnippet } from "./lib/storage";

const NARROW_QUERY = "(max-width: 900px)";

/** Share URLs restore the form; they never start a Run on their own (design.md). */
function initialState(): ShareState {
  if (typeof window !== "undefined") {
    const restored = readShareStateFromHash(window.location.hash);
    if (restored !== null) {
      return restored;
    }
  }
  return {
    language: DEFAULT_LANGUAGE,
    target: DEFAULT_TARGET,
    code: getSample(DEFAULT_LANGUAGE, DEFAULT_TARGET),
    compileOptions: "",
  };
}

export function App() {
  const initial = useMemo(() => initialState(), []);

  const [language, setLanguage] = useState<Language>(initial.language);
  const [target, setTarget] = useState<TargetId>(initial.target);
  const [code, setCode] = useState(initial.code);
  const [compileOptions, setCompileOptions] = useState(initial.compileOptions);

  const [phase, setPhase] = useState<RunPhase>({ kind: "idle" });
  const [resultTarget, setResultTarget] = useState<TargetId>(initial.target);
  const [resultTab, setResultTab] = useState<ResultTab>("output");
  const [mainTab, setMainTab] = useState<"code" | "result">("code");

  const [snippets, setSnippets] = useState<SavedSnippet[]>(() => loadSnippets(window.localStorage));
  const [saveOpen, setSaveOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [snippetName, setSnippetName] = useState("");

  const [notices, setNotices] = useState<Record<"share" | "save", ToolbarNotice | null>>({
    share: null,
    save: null,
  });

  const {
    copy,
    copied,
    error: clipboardError,
    reset: resetClipboard,
  } = useClipboard({ timeout: 2000 });
  const isNarrow = useMediaQuery(NARROW_QUERY, undefined, { getInitialValueInEffect: false });
  const colorScheme = useComputedColorScheme("light", { getInitialValueInEffect: false });
  const running = phase.kind === "running";
  const runInFlight = useRef(false);
  const view = useMemo(() => deriveResultView(phase, language), [phase, language]);

  const showNotice = useCallback((action: "share" | "save", next: ToolbarNotice) => {
    setNotices((current) => ({ ...current, [action]: next }));
  }, []);

  const dismissNotice = useCallback(
    (action: "share" | "save") => {
      if (action === "share") resetClipboard();
      setNotices((current) => ({ ...current, [action]: null }));
    },
    [resetClipboard],
  );

  // Assembly is meaningless for assembly input, so never display it selected
  // even if it was selected before switching to an asm input.
  const displayedResultTab: ResultTab =
    language === "asm" && resultTab === "assembly" ? "output" : resultTab;

  const handleLanguageChange = useCallback(
    (next: Language) => {
      if (isUntouchedSample(code)) {
        setCode(getSample(next, target));
      }
      setLanguage(next);
    },
    [code, target],
  );

  const handleTargetChange = useCallback(
    (next: TargetId) => {
      if (isUntouchedSample(code)) {
        setCode(getSample(language, next));
      }
      setTarget(next);
    },
    [code, language],
  );

  const handleRun = useCallback(async () => {
    if (runInFlight.current) return;
    runInFlight.current = true;
    // The previous result is dropped rather than kept for comparison, so what
    // is on screen always belongs to the code that was just submitted.
    setResultTarget(target);
    setPhase({ kind: "running" });
    setResultTab("output");
    setMainTab("result");

    try {
      const outcome = await requestRun({
        language,
        target,
        code,
        compileOptions,
      });

      setPhase(
        outcome.ok
          ? { kind: "result", result: outcome.result }
          : { kind: "failed", message: outcome.message },
      );
    } finally {
      runInFlight.current = false;
    }
  }, [language, target, code, compileOptions]);

  const handleShare = () => {
    resetClipboard();
    setNotices((current) => ({ ...current, share: null }));
    const built = buildShareUrl(window.location.href, {
      language,
      target,
      code,
      compileOptions,
    });

    if (!built.ok) {
      showNotice("share", {
        tone: "error",
        text: `Too long to share: ${built.length} of ${built.limit} characters. Shorten the code.`,
      });
      return;
    }

    window.history.replaceState(null, "", built.url);
    copy(built.url);
  };

  const handleSave = useCallback(
    (name: string) => {
      setSnippets(
        saveSnippet(window.localStorage, {
          name,
          language,
          target,
          code,
          compileOptions,
        }),
      );
      setSnippetName(name);
      setSaveOpen(false);
      showNotice("save", { tone: "info", text: `Saved “${name}”.` });
    },
    [language, target, code, compileOptions, showNotice],
  );

  const handleSelectSnippet = useCallback((snippet: SavedSnippet) => {
    setLanguage(snippet.language);
    setTarget(snippet.target);
    setCode(snippet.code);
    setCompileOptions(snippet.compileOptions);
    setSnippetName(snippet.name);
    setPhase({ kind: "idle" });
    setOpenOpen(false);
  }, []);

  const handleDeleteSnippet = useCallback((snippet: SavedSnippet) => {
    setSnippets(deleteSnippet(window.localStorage, snippet.id));
  }, []);

  const editor = (
    <LazyCodeEditor
      value={code}
      language={language}
      target={target}
      colorScheme={colorScheme}
      ariaLabel="Source code"
      onChange={setCode}
    />
  );

  const result = (
    <ResultPane
      view={view}
      tab={displayedResultTab}
      onTabChange={setResultTab}
      language={language}
      target={resultTarget}
      colorScheme={colorScheme}
    />
  );

  return (
    <div className="app">
      <Toolbar
        language={language}
        onLanguageChange={handleLanguageChange}
        target={target}
        onTargetChange={handleTargetChange}
        compileOptions={compileOptions}
        onCompileOptionsChange={setCompileOptions}
        running={running}
        onRun={() => void handleRun()}
        onOpen={() => setOpenOpen(true)}
        onSave={() => setSaveOpen(true)}
        onShare={handleShare}
        notices={{
          save: notices.save,
          share:
            notices.share ??
            (clipboardError
              ? {
                  tone: "error",
                  text: "Could not copy the link. Copy the URL from the address bar.",
                }
              : copied
                ? { tone: "info", text: "Share URL copied to clipboard." }
                : null),
        }}
        onDismissNotice={dismissNotice}
      />

      {isNarrow ? (
        <Tabs
          className="workspace workspace--stacked"
          value={mainTab}
          onChange={(value) => {
            if (value !== null) setMainTab(value as "code" | "result");
          }}
          keepMounted
          keepMountedMode="display-none"
        >
          <Tabs.List className="workspace__switch" aria-label="Workspace">
            <Tabs.Tab value="code">Code</Tabs.Tab>
            <Tabs.Tab value="result">Result</Tabs.Tab>
          </Tabs.List>
          {/* Keep the hidden source editor mounted, including its editing state and history. */}
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

      <SaveDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        defaultName={snippetName}
        onSave={handleSave}
      />
      <OpenDialog
        open={openOpen}
        onOpenChange={setOpenOpen}
        snippets={snippets}
        onSelect={handleSelectSnippet}
        onDelete={handleDeleteSnippet}
      />
    </div>
  );
}
