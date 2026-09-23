import { Button } from "@mantine/core";
import { useEffect, useRef, useState } from "react";

export function CopyButton({
  text,
  label,
  disabled = false,
}: {
  text: string | (() => string);
  label: string;
  disabled?: boolean;
}) {
  const [notice, setNotice] = useState("");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function copy() {
    clearTimeout(timer.current);
    try {
      await navigator.clipboard.writeText(typeof text === "function" ? text() : text);
      setNotice("Copied");
    } catch {
      setNotice("Could not copy. Try again.");
    }
    timer.current = setTimeout(() => setNotice(""), 3000);
  }
  return (
    <span className="copy-action">
      <Button variant="subtle" size="compact-xs" disabled={disabled} onClick={() => void copy()}>
        {label}
      </Button>
      <span role="status" className="copy-action__notice">
        {notice}
      </span>
    </span>
  );
}
