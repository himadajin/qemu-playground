/**
 * Linux signal numbers, hardcoded on purpose.
 *
 * The exit statuses being decoded come from a Linux container, while the API
 * may well run on macOS during development, where `os.constants.signals`
 * numbers several signals differently. Reading them from the host would
 * silently mislabel things like SIGUSR1.
 */
const LINUX_SIGNAL_NAMES: Readonly<Record<number, string>> = {
  1: "SIGHUP",
  2: "SIGINT",
  3: "SIGQUIT",
  4: "SIGILL",
  5: "SIGTRAP",
  6: "SIGABRT",
  7: "SIGBUS",
  8: "SIGFPE",
  9: "SIGKILL",
  10: "SIGUSR1",
  11: "SIGSEGV",
  12: "SIGUSR2",
  13: "SIGPIPE",
  14: "SIGALRM",
  15: "SIGTERM",
  16: "SIGSTKFLT",
  17: "SIGCHLD",
  18: "SIGCONT",
  19: "SIGSTOP",
  20: "SIGTSTP",
  21: "SIGTTIN",
  22: "SIGTTOU",
  23: "SIGURG",
  24: "SIGXCPU",
  25: "SIGXFSZ",
  26: "SIGVTALRM",
  27: "SIGPROF",
  28: "SIGWINCH",
  29: "SIGIO",
  30: "SIGPWR",
  31: "SIGSYS",
};

/**
 * Maps a shell-observed status to a signal name, or `undefined` when it should
 * be read as an ordinary exit code.
 *
 * QEMU user-mode re-raises an uncaught guest signal on itself, so a guest that
 * segfaults makes the `qemu-<arch>` process die from SIGSEGV and the shell
 * reports 128+11. (Verified against the runner image: SIGSEGV -> 139,
 * SIGABRT -> 134, on both rv64 and aarch64.) A program that deliberately calls
 * `exit(139)` is indistinguishable from this at the shell level; that
 * ambiguity is inherent to the wait-status encoding and is accepted here.
 */
export function signalNameFromStatus(status: number): string | undefined {
  if (!Number.isInteger(status) || status <= 128) return undefined;
  return LINUX_SIGNAL_NAMES[status - 128];
}
