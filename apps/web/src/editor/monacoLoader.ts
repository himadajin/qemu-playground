import type { MonacoApi } from "./monacoSetup";

/**
 * Loads the Monaco bundle on demand, once per page. The import is dynamic so
 * the toolbar and the page skeleton paint before the editor arrives.
 */
let pending: Promise<MonacoApi> | null = null;

export function loadMonaco(): Promise<MonacoApi> {
  pending ??= import("./monacoSetup").then((module) => module.monaco);
  return pending;
}
