import { Button, Group, Modal } from "@mantine/core";
import { useMediaQuery } from "@mantine/hooks";
import { getTargetDefinition } from "@qemu-playground/shared";
import { useState } from "react";
import type { RunRecord } from "../hooks/useProgramExecution";
import { fullRunTime } from "../lib/runLog";
import { deriveResultView } from "../lib/runView";
import { CopyButton } from "./CopyButton";
import { LazyCodeEditor } from "./LazyCodeEditor";

export function RunViewer({
  run,
  kind,
  colorScheme,
  onClose,
}: {
  run: RunRecord;
  kind: "details" | "assembly";
  colorScheme: "light" | "dark";
  onClose: () => void;
}) {
  const narrow = useMediaQuery("(max-width: 1080px)");
  const [searchRequest, setSearchRequest] = useState(0);
  const assembly = deriveResultView(run.phase, run.input.language).assembly;
  const value = kind === "details" ? run.input.code : assembly.kind === "code" ? assembly.code : "";
  const label = kind === "details" ? "Captured source" : "Generated assembly";
  return (
    <Modal
      opened
      returnFocus={false}
      closeButtonProps={{ "aria-label": "Close run viewer" }}
      onClose={onClose}
      title={`Run #${run.sequence} · ${kind === "details" ? "Details" : "Assembly"}`}
      size="min(1100px, 94vw)"
      fullScreen={!!narrow}
    >
      <div className="run-viewer">
        <dl className="run-viewer__settings">
          <div>
            <dt>File at run time</dt>
            <dd>{run.fileName}</dd>
          </div>
          <div>
            <dt>Started</dt>
            <dd>{fullRunTime(run.startedAt)}</dd>
          </div>
          <div>
            <dt>Target</dt>
            <dd>{getTargetDefinition(run.input.target).displayName}</dd>
          </div>
          {kind === "details" && (
            <>
              <div>
                <dt>Language</dt>
                <dd>{run.input.language === "c" ? "C" : "Assembly"}</dd>
              </div>
              <div>
                <dt>Compiler options</dt>
                <dd>
                  <code>{run.input.compileOptions || "default"}</code>
                </dd>
              </div>
            </>
          )}
        </dl>
        <Group gap="xs" className="run-viewer__tools">
          <CopyButton text={value} label={kind === "details" ? "Copy source" : "Copy assembly"} />
          <Button
            variant="subtle"
            size="compact-xs"
            onClick={() => setSearchRequest((request) => request + 1)}
          >
            Find
          </Button>
        </Group>
        {kind === "assembly" && assembly.kind === "code" && assembly.truncated && (
          <p className="assembly__flag">Output truncated; the assembly below is incomplete.</p>
        )}
        <div className="run-viewer__editor">
          <LazyCodeEditor
            value={value}
            language={kind === "details" ? run.input.language : "asm"}
            target={run.input.target}
            colorScheme={colorScheme}
            readOnly
            ariaLabel={label}
            searchRequest={searchRequest}
          />
        </div>
      </div>
    </Modal>
  );
}
