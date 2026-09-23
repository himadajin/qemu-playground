import { Button, Group, Modal, Text } from "@mantine/core";
import type { ReactNode } from "react";
export function ConfirmDiscardDialog({
  opened,
  title,
  children,
  cancelLabel,
  confirmLabel,
  disabled,
  onClose,
  onConfirm,
}: {
  opened: boolean;
  title: string;
  children: ReactNode;
  cancelLabel: string;
  confirmLabel: string;
  disabled: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal opened={opened} onClose={onClose} title={title} centered size="sm">
      <Text size="sm">{children}</Text>
      <Group justify="flex-end" mt="md">
        <Button data-autofocus variant="default" onClick={onClose}>
          {cancelLabel}
        </Button>
        <Button color="red" disabled={disabled} onClick={onConfirm}>
          {confirmLabel}
        </Button>
      </Group>
    </Modal>
  );
}
