import { ActionIcon, Menu } from "@mantine/core";
import { IconDots } from "@tabler/icons-react";

export type FileAction = "rename" | "duplicate" | "download" | "delete";

interface Props {
  filename: string;
  canDelete: boolean;
  onAction: (action: FileAction) => void;
  onReorder: () => void;
}

export function FileActionsMenu({ filename, canDelete, onAction, onReorder }: Props) {
  return (
    <Menu position="bottom-end" withinPortal>
      <Menu.Target>
        <ActionIcon
          className="file__menu"
          variant="subtle"
          color="gray"
          size="sm"
          aria-label={`Actions for ${filename}`}
        >
          <IconDots size={16} />
        </ActionIcon>
      </Menu.Target>
      <Menu.Dropdown>
        <Menu.Item onClick={() => onAction("rename")}>Rename</Menu.Item>
        <Menu.Item onClick={() => onAction("duplicate")}>Duplicate</Menu.Item>
        <Menu.Item onClick={() => onAction("download")}>Download</Menu.Item>
        <Menu.Item onClick={onReorder}>Reorder files</Menu.Item>
        <Menu.Divider />
        <Menu.Item color="red" disabled={!canDelete} onClick={() => onAction("delete")}>
          Delete
        </Menu.Item>
      </Menu.Dropdown>
    </Menu>
  );
}
