import type { Language, TargetId } from "@qemu-playground/shared";
import * as Tabs from "@radix-ui/react-tabs";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CodeEditor } from "./components/CodeEditor";
import { ResultPane, type ResultTab } from "./components/ResultPane";
import { OpenDialog, SaveDialog } from "./components/SnippetDialogs";
import { Toolbar, type ToolbarNotice } from "./components/Toolbar";
import { useMediaQuery } from "./hooks/useMediaQuery";
import { requestRun } from "./lib/runApi";
import { deriveResultView, type RunPhase } from "./lib/runView";
import { DEFAULT_LANGUAGE, DEFAULT_TARGET, getSample, isUntouchedSample } from "./lib/samples";
import { buildShareUrl, readShareStateFromHash, type ShareState } from "./lib/share";
import { deleteSnippet, loadSnippets, saveSnippet, type SavedSnippet } from "./lib/storage";

const NARROW_QUERY = "(max-width: 900px)";
const NOTICE_TIMEOUT_MS = 5000;

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
  const [resultTab, setResultTab] = useState<ResultTab>("output");
  const [mainTab, setMainTab] = useState<"code" | "result">("code");

  const [snippets, setSnippets] = useState<SavedSnippet[]>(() => loadSnippets(window.localStorage));
  const [saveOpen, setSaveOpen] = useState(false);
  const [openOpen, setOpenOpen] = useState(false);
  const [snippetName, setSnippetName] = useState("");

  const [notice, setNotice] = useState<ToolbarNotice | null>(null);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isNarrow = useMediaQuery(NARROW_QUERY);
  const running = phase.kind === "running";
  const view = useMemo(() => deriveResultView(phase, language), [phase, language]);

  const showNotice = useCallback((next: ToolbarNotice) => {
    setNotice(next);
    if (noticeTimer.current !== null) {
      clearTimeout(noticeTimer.current);
    }
    noticeTimer.current = setTimeout(() => setNotice(null), NOTICE_TIMEOUT_MS);
  }, []);

  useEffect(
    () => () => {
      if (noticeTimer.current !== null) {
        clearTimeout(noticeTimer.current);
      }
    },
    [],
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
    // The previous result is dropped rather than kept for comparison, so what
    // is on screen always belongs to the code that was just submitted.
    setPhase({ kind: "running" });
    setResultTab("output");
    setMainTab("result");

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
  }, [language, target, code, compileOptions]);

  const handleShare = useCallback(async () => {
    const built = buildShareUrl(window.location.href, {
      language,
      target,
      code,
      compileOptions,
    });

    if (!built.ok) {
      showNotice({
        tone: "error",
        text: `Too long to share: ${built.length} of ${built.limit} characters. Shorten the code.`,
      });
      return;
    }

    window.history.replaceState(null, "", built.url);
    try {
      await navigator.clipboard.writeText(built.url);
      showNotice({ tone: "info", text: "Share URL copied to clipboard." });
    } catch {
      showNotice({
        tone: "error",
        text: "Could not copy; the share URL is in the address bar.",
      });
    }
  }, [language, target, code, compileOptions, showNotice]);

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
      showNotice({ tone: "info", text: `Saved “${name}”.` });
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
    <CodeEditor value={code} language={language} ariaLabel="Source code" onChange={setCode} />
  );

  const result = (
    <ResultPane
      view={view}
      tab={displayedResultTab}
      onTabChange={setResultTab}
      language={language}
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
        onShare={() => void handleShare()}
        notice={notice}
      />

      {isNarrow ? (
        <Tabs.Root
          className="workspace workspace--stacked"
          value={mainTab}
          onValueChange={(value) => setMainTab(value as "code" | "result")}
        >
          <Tabs.List className="workspace__switch">
            <Tabs.Trigger className="tab meta-label" value="code">
              Code
            </Tabs.Trigger>
            <Tabs.Trigger className="tab meta-label" value="result">
              Result
            </Tabs.Trigger>
          </Tabs.List>
          {/* forceMount keeps the editor alive across switches; the headless
              primitive leaves both panels mounted and visible, so the inactive
              one is hidden by CSS on [data-state="inactive"]. */}
          <Tabs.Content className="workspace__panel" value="code" forceMount>
            {editor}
          </Tabs.Content>
          <Tabs.Content className="workspace__panel" value="result" forceMount>
            {result}
          </Tabs.Content>
        </Tabs.Root>
      ) : (
        <main className="workspace">
          <div className="workspace__pane">{editor}</div>
          <div className="workspace__pane">{result}</div>
        </main>
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
