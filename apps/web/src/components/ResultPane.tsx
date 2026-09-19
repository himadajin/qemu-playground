import type { Language } from "@qemu-playground/shared";
import { Badge, Tabs, Text } from "@mantine/core";
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
        <Text size="xs" c="dimmed">
          {title}
        </Text>
        {truncated === true && (
          <Badge size="xs" color="orange" variant="light">
            truncated
          </Badge>
        )}
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
    <Tabs
      className="result"
      value={tab}
      onChange={(value) => {
        if (value !== null) onTabChange(value as ResultTab);
      }}
      keepMounted={false}
    >
      <div className="result__head">
        <Tabs.List className="result__tabs" aria-label="Results">
          <Tabs.Tab value="output">Output</Tabs.Tab>
          <Tabs.Tab value="build">Build</Tabs.Tab>
          <Tabs.Tab value="assembly" disabled={language === "asm"}>
            Assembly
          </Tabs.Tab>
        </Tabs.List>
        <span role="status" aria-live="polite">
          {view.badge !== null && <StatusBadge kind={view.badge} />}
        </span>
      </div>

      <Tabs.Panel className="result__panel" value="output">
        <div className="result__state">
          <span>{output.state}</span>
          {output.exit !== null && <span className="result__exit">{output.exit}</span>}
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
      </Tabs.Panel>

      <Tabs.Panel className="result__panel" value="build">
        <LogSection
          title="compiler output"
          text={build.log}
          truncated={build.truncated}
          placeholder={build.placeholder ?? ""}
        />
      </Tabs.Panel>

      <Tabs.Panel className="result__panel result__panel--flush" value="assembly">
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
      </Tabs.Panel>
    </Tabs>
  );
}
