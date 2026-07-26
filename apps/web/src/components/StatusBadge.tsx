import { Badge, type BadgeProps } from "@radix-ui/themes";
import {
  STATUS_BADGE_LABEL,
  type StatusBadgeKind,
} from "../lib/runView";

type BadgeColor = BadgeProps["color"];

/**
 * Colour is only spent where the state carries meaning: blue while a Run is
 * in flight, green/red/amber for how it ended. Everything else in the UI
 * stays grayscale.
 */
const BADGE_COLOR: Record<StatusBadgeKind, BadgeColor> = {
  success: "green",
  compile_error: "red",
  runtime_error: "red",
  timeout: "amber",
  running: "blue",
  error: "red",
};

export function StatusBadge({ kind }: { kind: StatusBadgeKind }) {
  return (
    <Badge color={BADGE_COLOR[kind]} variant="soft" radius="small" size="1">
      {STATUS_BADGE_LABEL[kind]}
    </Badge>
  );
}
