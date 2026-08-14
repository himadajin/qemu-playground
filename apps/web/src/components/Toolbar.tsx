import { TARGETS, type Language, type TargetId } from "@qemu-playground/shared";
import * as Select from "@radix-ui/react-select";
import { useRef, type KeyboardEvent } from "react";

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

const LANGUAGES: ReadonlyArray<{ value: Language; label: string }> = [
  { value: "c", label: "C" },
  { value: "asm", label: "Assembly" },
];

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
  const languageRefs = useRef<Array<HTMLButtonElement | null>>([]);

  // WAI-ARIA radio group pattern: arrows move focus and select in one step.
  const handleLanguageKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const step =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? 1
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? -1
          : 0;
    if (step === 0) {
      return;
    }
    event.preventDefault();
    const nextIndex = (index + step + LANGUAGES.length) % LANGUAGES.length;
    const next = LANGUAGES[nextIndex];
    if (next === undefined) {
      return;
    }
    languageRefs.current[nextIndex]?.focus();
    onLanguageChange(next.value);
  };

  return (
    <header className="toolbar">
      <span className="toolbar__brand">QEMU Playground</span>

      <div className="toolbar__toggle" role="radiogroup" aria-label="Language">
        {LANGUAGES.map((item, index) => (
          <button
            key={item.value}
            ref={(node) => {
              languageRefs.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={language === item.value}
            tabIndex={language === item.value ? 0 : -1}
            className="toolbar__toggle-item"
            onClick={() => onLanguageChange(item.value)}
            onKeyDown={(event) => handleLanguageKeyDown(event, index)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <Select.Root value={target} onValueChange={(value) => onTargetChange(value as TargetId)}>
        <Select.Trigger className="toolbar__select-trigger" aria-label="Target">
          <Select.Value />
          <Select.Icon className="toolbar__select-chevron">▾</Select.Icon>
        </Select.Trigger>
        <Select.Portal>
          <Select.Content className="toolbar__select-content" position="popper">
            <Select.Viewport>
              {TARGETS.map((definition) => (
                <Select.Item
                  key={definition.id}
                  value={definition.id}
                  className="toolbar__select-item"
                >
                  <Select.ItemText>{definition.displayName}</Select.ItemText>
                  <Select.ItemIndicator className="toolbar__select-indicator">
                    ✓
                  </Select.ItemIndicator>
                </Select.Item>
              ))}
            </Select.Viewport>
          </Select.Content>
        </Select.Portal>
      </Select.Root>

      <input
        className="toolbar__options"
        type="text"
        placeholder="-O2"
        spellCheck={false}
        autoComplete="off"
        aria-label="Compile options"
        value={compileOptions}
        onChange={(event) => onCompileOptionsChange(event.target.value)}
      />

      <button
        type="button"
        className="toolbar__run meta-label"
        onClick={onRun}
        disabled={running}
        aria-label="Run"
      >
        Run
      </button>

      <div className="toolbar__spacer" />

      {notice !== null && (
        <span className={`toolbar__notice toolbar__notice--${notice.tone}`} role="status">
          {notice.text}
        </span>
      )}

      <button type="button" className="toolbar__action meta-label" onClick={onOpen}>
        Open
      </button>
      <button type="button" className="toolbar__action meta-label" onClick={onSave}>
        Save
      </button>
      <button type="button" className="toolbar__action meta-label" onClick={onShare}>
        Share
      </button>
    </header>
  );
}
