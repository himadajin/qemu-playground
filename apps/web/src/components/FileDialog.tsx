import { Button, Group, Modal, NativeSelect, Stack, TextInput } from "@mantine/core";
import { TARGETS, type TargetId } from "@qemu-playground/shared";
import { useState } from "react";
import { validateFilename, type ProgramFile } from "../lib/files";

type ProgramType = "c" | TargetId;
export type FileDialogSubmission =
  | { mode: "new"; name: string; programType: ProgramType }
  | { mode: "import"; name: string; target?: TargetId }
  | { mode: "rename"; name: string }
  | { mode: "add"; name: string };

export interface FileDraft {
  mode: "new" | "import" | "rename" | "add";
  file: ProgramFile;
}
export function FileDialog({
  draft,
  files,
  onClose,
  onSubmit,
}: {
  draft: FileDraft;
  files: ProgramFile[];
  onClose: () => void;
  onSubmit: (submission: FileDialogSubmission) => void;
}) {
  const [name, setName] = useState(draft.file.name.slice(0, -2));
  const [programType, setProgramType] = useState<ProgramType>(
    draft.file.language === "c" ? "c" : draft.file.target,
  );
  const [importTarget, setImportTarget] = useState<TargetId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [targetError, setTargetError] = useState<string | null>(null);
  const language = draft.mode === "new" ? (programType === "c" ? "c" : "asm") : draft.file.language;
  const title = {
    new: "New file",
    import: "Import source",
    rename: "Rename file",
    add: "Add to files",
  }[draft.mode];
  return (
    <Modal opened onClose={onClose} title={title} centered size="sm">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          const validated = validateFilename(
            name,
            language,
            files,
            draft.mode === "rename" ? draft.file.id : undefined,
          );
          if (!validated.ok) {
            setError(validated.error);
            return;
          }
          switch (draft.mode) {
            case "new":
              onSubmit({ mode: "new", name: validated.name, programType });
              break;
            case "import":
              if (language === "asm") {
                if (!importTarget) {
                  setTargetError("Choose an architecture.");
                  return;
                }
                onSubmit({ mode: "import", name: validated.name, target: importTarget });
              } else {
                onSubmit({ mode: "import", name: validated.name });
              }
              break;
            case "rename":
            case "add":
              onSubmit({ mode: draft.mode, name: validated.name });
          }
        }}
      >
        <Stack gap="md">
          <TextInput
            data-autofocus
            label="Filename"
            value={name}
            rightSection={language === "c" ? ".c" : ".s"}
            error={error}
            onChange={(event) => {
              setName(event.currentTarget.value);
              setError(null);
            }}
          />
          {draft.mode === "new" && (
            <NativeSelect
              label="Program type"
              value={programType}
              data={[
                { value: "c", label: "C" },
                ...TARGETS.map((item) => ({
                  value: item.id,
                  label: `Assembly (${item.displayName})`,
                })),
              ]}
              onChange={(event) => {
                setProgramType(event.currentTarget.value as ProgramType);
                setError(null);
              }}
            />
          )}
          {draft.mode === "import" && language === "asm" && (
            <NativeSelect
              label="Assembly architecture"
              required
              value={importTarget ?? ""}
              error={targetError}
              data={[
                { value: "", label: "Choose an architecture", disabled: true },
                ...TARGETS.map((item) => ({ value: item.id, label: item.displayName })),
              ]}
              onChange={(event) => {
                setImportTarget((event.currentTarget.value as TargetId) || null);
                setTargetError(null);
              }}
            />
          )}
          <Group justify="flex-end">
            <Button variant="default" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{title}</Button>
          </Group>
        </Stack>
      </form>
    </Modal>
  );
}
