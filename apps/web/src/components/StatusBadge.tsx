import { Badge } from "@mantine/core";
import { STATUS_BADGE_LABEL, type StatusBadgeKind } from "../lib/runView";

const BADGE_COLOR: Record<StatusBadgeKind, string> = {
  success: "green",
  nonzero: "red",
  running: "blue",
  compile_error: "red",
  runtime_error: "red",
  timeout: "orange",
  error: "red",
};

export function StatusBadge({ kind }: { kind: StatusBadgeKind }) {
  return (
    <Badge size="sm" color={BADGE_COLOR[kind]} tt="none" style={{ flexShrink: 0 }}>
      {STATUS_BADGE_LABEL[kind]}
    </Badge>
  );
}
