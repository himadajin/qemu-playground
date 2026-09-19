import { getTargetDefinition } from "@qemu-playground/shared";
import { Button, CloseButton, Group, Modal, Stack, Text, TextInput } from "@mantine/core";
import { useState } from "react";
import type { SavedSnippet } from "../lib/storage";

const LANGUAGE_LABEL = { c: "C", asm: "Assembly" } as const;

interface SaveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultName: string;
  onSave: (name: string) => void;
}

/** Save is a name prompt and nothing more; storage stays out of the way. */
export function SaveDialog({ open, onOpenChange, defaultName, onSave }: SaveDialogProps) {
  const [name, setName] = useState(defaultName);

  // Reset the field to the current default whenever the dialog (re)opens or
  // the default itself changes while open, mirroring what a
  // `[open, defaultName]`-keyed effect would do, but adjusted during render
  // instead of in a post-commit effect.
  const [prevOpen, setPrevOpen] = useState(open);
  const [prevDefaultName, setPrevDefaultName] = useState(defaultName);
  if (open !== prevOpen || defaultName !== prevDefaultName) {
    setPrevOpen(open);
    setPrevDefaultName(defaultName);
    if (open) {
      setName(defaultName);
    }
  }

  const trimmed = name.trim();

  return (
    <Modal
      opened={open}
      onClose={() => onOpenChange(false)}
      title="Save snippet"
      size="sm"
      closeButtonProps={{ "aria-label": "Close save dialog" }}
    >
      <Text size="sm" c="dimmed" mb="sm" id="save-description">
        Stored in this browser only. Saving under an existing name replaces it.
      </Text>
      <form
        onSubmit={(event) => {
          event.preventDefault();
          if (trimmed !== "") onSave(trimmed);
        }}
      >
        <TextInput
          label="Snippet name"
          data-autofocus
          placeholder="Snippet name"
          aria-describedby="save-description"
          value={name}
          onChange={(event) => setName(event.currentTarget.value)}
        />
        <Group justify="flex-end" mt="md">
          <Button variant="default" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" disabled={trimmed === ""}>
            Save
          </Button>
        </Group>
      </form>
    </Modal>
  );
}

interface OpenDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  snippets: SavedSnippet[];
  onSelect: (snippet: SavedSnippet) => void;
  onDelete: (snippet: SavedSnippet) => void;
}

/** Open lists the saved snippets on demand; there is no permanent file tree. */
export function OpenDialog({ open, onOpenChange, snippets, onSelect, onDelete }: OpenDialogProps) {
  return (
    <Modal
      opened={open}
      onClose={() => onOpenChange(false)}
      title="Open snippet"
      size="md"
      closeButtonProps={{ "aria-label": "Close open dialog" }}
    >
      <Text size="sm" c="dimmed" mb="sm">
        Saved in this browser.
      </Text>
      {snippets.length === 0 ? (
        <Text size="sm" c="dimmed">
          Nothing saved yet.
        </Text>
      ) : (
        <Stack component="ul" gap="xs" className="snippet-list">
          {snippets.map((snippet, index) => (
            <Group component="li" key={snippet.id} gap="xs" wrap="nowrap">
              <Button
                variant="default"
                className="snippet-list__open"
                data-autofocus={index === 0 || undefined}
                onClick={() => onSelect(snippet)}
              >
                <span className="snippet-list__text">
                  <Text component="span" size="sm" truncate>
                    {snippet.name}
                  </Text>
                  <Text component="span" size="xs" c="dimmed" truncate>
                    {LANGUAGE_LABEL[snippet.language]} ·{" "}
                    {getTargetDefinition(snippet.target).displayName}
                  </Text>
                </span>
              </Button>
              <CloseButton
                aria-label={`Delete ${snippet.name}`}
                onClick={() => onDelete(snippet)}
              />
            </Group>
          ))}
        </Stack>
      )}
      <Group justify="flex-end" mt="md">
        <Button
          variant="default"
          data-autofocus={snippets.length === 0 || undefined}
          onClick={() => onOpenChange(false)}
        >
          Close
        </Button>
      </Group>
    </Modal>
  );
}
