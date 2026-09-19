import { useState } from "react";
import { useClipboard } from "@mantine/hooks";
import { buildShareUrl, type ShareState } from "../lib/share";
import type { ToolbarNotice } from "../components/Toolbar";

export function useProgramShare() {
  const [shareNotice, setShareNotice] = useState<ToolbarNotice | null>(null);
  const {
    copy,
    copied,
    error: clipboardError,
    reset: resetClipboard,
  } = useClipboard({ timeout: 2000 });
  function share(active: ShareState) {
    resetClipboard();
    setShareNotice(null);
    const built = buildShareUrl(window.location.href, active);
    if (!built.ok) {
      setShareNotice({
        tone: "error",
        text: `Too long to share: ${built.length} of ${built.limit} characters. Shorten the code.`,
      });
      return;
    }
    window.history.replaceState(null, "", built.url);
    copy(built.url);
  }

  const notice: ToolbarNotice | null =
    shareNotice ??
    (clipboardError
      ? { tone: "error", text: "Could not copy the link. Copy the URL from the address bar." }
      : copied
        ? { tone: "info", text: "Share URL copied to clipboard." }
        : null);
  function dismiss() {
    setShareNotice(null);
    resetClipboard();
  }
  return { share, notice, dismiss };
}
