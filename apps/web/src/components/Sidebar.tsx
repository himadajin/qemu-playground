import { Flex, Tooltip, UnstyledButton } from "@mantine/core";
import {
  IconLayoutSidebarLeftCollapse,
  IconLayoutSidebarLeftExpand,
  IconLayoutSidebarRightCollapse,
  IconLayoutSidebarRightExpand,
} from "@tabler/icons-react";
import type { ReactNode } from "react";

export function Sidebar({
  side,
  opened,
  contentId,
  actions,
  children,
}: {
  side: "left" | "right";
  opened: boolean;
  contentId: string;
  actions: ReactNode;
  children: ReactNode;
}) {
  return (
    <Flex
      component="aside"
      direction="column"
      className="sidebar"
      data-side={side}
      data-opened={opened}
      h="100%"
      w="100%"
      mih={0}
    >
      {actions}
      <div
        id={contentId}
        className="sidebar__content"
        hidden={!opened}
        inert={!opened}
        aria-hidden={!opened}
      >
        {children}
      </div>
    </Flex>
  );
}

export function SidebarToggle({
  side = "left",
  opened,
  controls,
  label,
  iconOnly = false,
  onToggle,
}: {
  side?: "left" | "right";
  opened: boolean;
  controls: string;
  label: string;
  iconOnly?: boolean;
  onToggle: () => void;
}) {
  const Icon =
    side === "left"
      ? opened
        ? IconLayoutSidebarLeftCollapse
        : IconLayoutSidebarLeftExpand
      : opened
        ? IconLayoutSidebarRightCollapse
        : IconLayoutSidebarRightExpand;
  return (
    <Tooltip
      label={label}
      disabled={!iconOnly && opened}
      position={side === "left" ? "right" : "left"}
      events={{ hover: true, focus: true, touch: false }}
    >
      <UnstyledButton
        className="sidebar__action sidebar__toggle"
        aria-label={label}
        aria-expanded={opened}
        aria-controls={controls}
        onClick={onToggle}
      >
        <span className="sidebar__icon">
          <Icon size={18} />
        </span>
        {!iconOnly && (
          <span className="sidebar__label" aria-hidden="true">
            {label}
          </span>
        )}
      </UnstyledButton>
    </Tooltip>
  );
}
