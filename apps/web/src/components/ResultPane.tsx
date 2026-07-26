import type { Language } from "@qemu-playground/shared";
import { Tabs, Text } from "@radix-ui/themes";
import type { ResultView } from "../lib/runView";
import { CodeEditor } from "./CodeEditor";
import { StatusBadge } from "./StatusBadge";

export type ResultTab = "output" | "build" | "assembly";

interface ResultPaneProps {
  view: ResultView;
  tab: ResultTab;
  onTabChange: (tab: ResultTab) => void;
  language: Language;
}

interface LogSectionProps {
  title: string;
  text: string | null;
  truncated?: boolean;
  placeholder: string;
}

function LogSection({ title, text, truncated, placeholder }: LogSectionProps) {
  const empty = text === null || text === "";
  return (
    <section className="log-section">
      <header className="log-section__head">
        <span className="log-section__title">{title}</span>
        {truncated === true && <span className="log-section__flag">truncated</span>}
      </header>
      {empty ? (
        <p className="log-section__placeholder">{placeholder}</p>
      ) : (
        <pre className="log">{text}</pre>
      )}
    </section>
  );
}

/**
 * Right-hand pane: one tab per kind of output, with the short status badge in
 * the header. Detail is always the raw log, never a rephrased summary.
 */
export function ResultPane({ view, tab, onTabChange, language }: ResultPaneProps) {
  const { output, build, assembly } = view;

  return (
    <Tabs.Root
      className="result"
      value={tab}
      onValueChange={(value) => onTabChange(value as ResultTab)}
    >
      <div className="result__head">
        <Tabs.List size="1" className="result__tabs">
          <Tabs.Trigger value="output">Output</Tabs.Trigger>
          <Tabs.Trigger value="build">Build</Tabs.Trigger>
          <Tabs.Trigger value="assembly" disabled={language === "asm"}>
            Assembly
          </Tabs.Trigger>
        </Tabs.List>
        {view.badge !== null && <StatusBadge kind={view.badge} />}
      </div>

      <Tabs.Content className="result__panel" value="output">
        <div className="result__state">
          <Text size="1">{output.state}</Text>
          {output.exit !== null && (
            <Text size="1" className="result__exit">
              {output.exit}
            </Text>
          )}
        </div>
        {output.log.length > 0 && (
          <LogSection title="log" text={output.log.join("\n")} placeholder="" />
        )}
        <LogSection
          title="stdout"
          text={output.stdout}
          truncated={output.stdoutTruncated}
          placeholder={
            output.stdout === null
              ? "The program did not run."
              : "The program wrote nothing to stdout."
          }
        />
        <LogSection
          title="stderr"
          text={output.stderr}
          truncated={output.stderrTruncated}
          placeholder={
            output.stderr === null
              ? "The program did not run."
              : "The program wrote nothing to stderr."
          }
        />
      </Tabs.Content>

      <Tabs.Content className="result__panel" value="build">
        <LogSection
          title="compiler output"
          text={build.log}
          truncated={build.truncated}
          placeholder={build.placeholder ?? ""}
        />
      </Tabs.Content>

      <Tabs.Content className="result__panel result__panel--flush" value="assembly">
        {assembly.kind === "code" ? (
          <div className="assembly">
            {assembly.truncated && (
              <p className="assembly__flag">Output truncated; the assembly below is incomplete.</p>
            )}
            <div className="assembly__editor">
              <CodeEditor
                value={assembly.code}
                language="asm"
                readOnly
                ariaLabel="Generated assembly"
              />
            </div>
          </div>
        ) : (
          <p className="log-section__placeholder">{assembly.message}</p>
        )}
      </Tabs.Content>
    </Tabs.Root>
  );
}
