import { TARGETS, type Language, type TargetId } from "@qemu-playground/shared";
import {
  Button,
  SegmentedControl,
  Select,
  Text,
  TextField,
} from "@radix-ui/themes";
import { FolderOpen, Play, Save, Share2 } from "lucide-react";

export interface ToolbarNotice {
  tone: "info" | "error";
  text: string;
}

interface ToolbarProps {
  language: Language;
  onLanguageChange: (language: Language) => void;
  target: TargetId;
  onTargetChange: (target: TargetId) => void;
  compileOptions: string;
  onCompileOptionsChange: (value: string) => void;
  running: boolean;
  onRun: () => void;
  onOpen: () => void;
  onSave: () => void;
  onShare: () => void;
  notice: ToolbarNotice | null;
}

/**
 * The only permanent control surface: language, target, compile options and
 * the four actions. No settings panel, no sidebar (ui.md).
 */
export function Toolbar({
  language,
  onLanguageChange,
  target,
  onTargetChange,
  compileOptions,
  onCompileOptionsChange,
  running,
  onRun,
  onOpen,
  onSave,
  onShare,
  notice,
}: ToolbarProps) {
  return (
    <header className="toolbar">
      <span className="toolbar__brand">QEMU Playground</span>

      <SegmentedControl.Root
        size="1"
        value={language}
        onValueChange={(value) => onLanguageChange(value as Language)}
        aria-label="Language"
      >
        <SegmentedControl.Item value="c">C</SegmentedControl.Item>
        <SegmentedControl.Item value="asm">Assembly</SegmentedControl.Item>
      </SegmentedControl.Root>

      <Select.Root
        size="1"
        value={target}
        onValueChange={(value) => onTargetChange(value as TargetId)}
      >
        <Select.Trigger aria-label="Target" variant="surface" color="gray" />
        <Select.Content position="popper">
          {TARGETS.map((definition) => (
            <Select.Item key={definition.id} value={definition.id}>
              {definition.displayName}
            </Select.Item>
          ))}
        </Select.Content>
      </Select.Root>

      <TextField.Root
        className="toolbar__options"
        size="1"
        placeholder="-O2"
        spellCheck={false}
        autoComplete="off"
        aria-label="Compile options"
        value={compileOptions}
        onChange={(event) => onCompileOptionsChange(event.target.value)}
      />

      <Button
        size="1"
        onClick={onRun}
        disabled={running}
        loading={running}
        aria-label="Run"
      >
        <Play size={14} aria-hidden="true" />
        Run
      </Button>

      <div className="toolbar__spacer" />

      {notice !== null && (
        <Text
          className="toolbar__notice"
          size="1"
          color={notice.tone === "error" ? "red" : "gray"}
          role="status"
        >
          {notice.text}
        </Text>
      )}

      <Button size="1" variant="surface" color="gray" onClick={onOpen}>
        <FolderOpen size={14} aria-hidden="true" />
        Open
      </Button>
      <Button size="1" variant="surface" color="gray" onClick={onSave}>
        <Save size={14} aria-hidden="true" />
        Save
      </Button>
      <Button size="1" variant="surface" color="gray" onClick={onShare}>
        <Share2 size={14} aria-hidden="true" />
        Share
      </Button>
    </header>
  );
}
