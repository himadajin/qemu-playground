import { STATUS_BADGE_LABEL, type StatusBadgeKind } from "../lib/runView";

/**
 * The UI is achromatic, so severity is carried by ink weight instead of hue:
 * ordinary states sit on a hairline border at 70% ink, failures get a full-ink
 * border and full-ink text.
 */
const BADGE_SEVERITY: Record<StatusBadgeKind, "normal" | "error"> = {
  success: "normal",
  running: "normal",
  compile_error: "error",
  runtime_error: "error",
  timeout: "error",
  error: "error",
};

export function StatusBadge({ kind }: { kind: StatusBadgeKind }) {
  return (
    <span className={`status-badge status-badge--${BADGE_SEVERITY[kind]} meta-label`}>
      {STATUS_BADGE_LABEL[kind]}
    </span>
  );
}
