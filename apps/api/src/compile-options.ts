/**
 * Turns the user-supplied `compileOptions` string into an argv array.
 *
 * The string is never handed to a shell: it is split here and passed to the
 * compiler as a plain argument vector inside the runner container. On top of
 * that, a conservative allowlist rejects anything that could redirect the
 * build's inputs or outputs (see the README for the full policy).
 */

export class InvalidCompileOptionsError extends Error {}

/** Hard caps so a pathological option string cannot blow up the argv. */
const MAX_OPTION_TOKENS = 64;
const MAX_OPTIONS_LENGTH = 2048;

/** Flags that carry no operand and touch no path. */
const ALLOWED_EXACT = new Set([
  // Optimisation levels.
  "-O",
  "-O0",
  "-O1",
  "-O2",
  "-O3",
  "-Os",
  "-Og",
  "-Ofast",
  // Debug info.
  "-g",
  "-g0",
  "-g1",
  "-g2",
  "-g3",
  "-ggdb",
  // Warnings.
  "-w",
  // Standards conformance.
  "-ansi",
  "-pedantic",
  "-pedantic-errors",
  // Link model. These change how the binary is produced but reference no path.
  "-static",
  "-static-pie",
  "-pie",
  "-no-pie",
  "-nostdlib",
  "-nostartfiles",
  "-nodefaultlibs",
  "-pthread",
]);

/**
 * Prefix families that are safe as a whole. `-W` covers every warning switch
 * (`-Wall`, `-Wextra`, ...), `-f`/`-m` cover code generation and machine
 * tuning, `-D`/`-U` cover macro definitions. Operands must be attached to
 * their flag (`-DFOO=1`, not `-D FOO=1`): a bare operand does not start with
 * `-` and is therefore rejected.
 */
const ALLOWED_PREFIXES = ["-std=", "-W", "-f", "-m", "-D", "-U"];

/**
 * Carve-outs from the allowed prefixes above: options that would otherwise
 * match but do read or write files, or pass arbitrary text to the assembler,
 * preprocessor or linker.
 */
const DENIED_PREFIXES = [
  "-Wl,",
  "-Wa,",
  "-Wp,",
  "-fplugin",
  "-fprofile",
  "-fdump",
  "-fopt-info",
  "-fstack-usage",
  "-fsave-optimization-record",
  "-fcallgraph-info",
  "-fdiagnostics-format",
  "-fcompare-debug",
  "-frepo",
  "-fmodule",
  "-fworking-directory",
  "-fdebug-prefix-map",
  "-ffile-prefix-map",
  "-fmacro-prefix-map",
  "-fsanitize-coverage",
];

function describeRejection(token: string): string {
  if (token.startsWith("@")) {
    return "response files (@file) are not allowed";
  }
  if (!token.startsWith("-")) {
    return "only options starting with '-' are allowed (extra source or object files cannot be passed)";
  }
  if (DENIED_PREFIXES.some((prefix) => token.startsWith(prefix))) {
    return "this option can read or write files outside the build";
  }
  return "this option is not on the allowlist";
}

function isAllowed(token: string): boolean {
  if (token.startsWith("@") || !token.startsWith("-")) return false;
  if (DENIED_PREFIXES.some((prefix) => token.startsWith(prefix))) return false;
  if (ALLOWED_EXACT.has(token)) return true;
  return ALLOWED_PREFIXES.some((prefix) => token.startsWith(prefix));
}

/**
 * Splits an option string into tokens the way a shell would split a command
 * line, honouring single quotes, double quotes and backslash escapes — but
 * without any expansion, substitution or command execution.
 */
export function tokenizeCompileOptions(input: string): string[] {
  const tokens: string[] = [];
  let current = "";
  let started = false;
  let quote: "'" | '"' | null = null;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i] as string;

    if (quote === "'") {
      if (char === "'") quote = null;
      else current += char;
      continue;
    }

    if (quote === '"') {
      if (char === '"') {
        quote = null;
      } else if (char === "\\" && i + 1 < input.length) {
        i += 1;
        current += input[i] as string;
      } else {
        current += char;
      }
      continue;
    }

    if (char === "'" || char === '"') {
      quote = char;
      started = true;
      continue;
    }
    if (char === "\\" && i + 1 < input.length) {
      i += 1;
      current += input[i] as string;
      started = true;
      continue;
    }
    if (/\s/.test(char)) {
      if (started) {
        tokens.push(current);
        current = "";
        started = false;
      }
      continue;
    }
    current += char;
    started = true;
  }

  if (quote !== null) {
    throw new InvalidCompileOptionsError("compileOptions has an unterminated quote");
  }
  if (started) tokens.push(current);
  return tokens;
}

/**
 * Validates and splits `compileOptions`. Returns the argv fragment to splice
 * into the compiler invocation; throws {@link InvalidCompileOptionsError}
 * (which the route maps to HTTP 400 `invalid_request`) otherwise.
 */
export function parseCompileOptions(input: string | undefined): string[] {
  if (input === undefined || input.trim() === "") return [];
  if (input.length > MAX_OPTIONS_LENGTH) {
    throw new InvalidCompileOptionsError(
      `compileOptions is too long (${input.length} characters, limit ${MAX_OPTIONS_LENGTH})`,
    );
  }

  const tokens = tokenizeCompileOptions(input);
  if (tokens.length > MAX_OPTION_TOKENS) {
    throw new InvalidCompileOptionsError(
      `compileOptions has too many options (${tokens.length}, limit ${MAX_OPTION_TOKENS})`,
    );
  }

  for (const token of tokens) {
    if (!isAllowed(token)) {
      throw new InvalidCompileOptionsError(
        `compileOptions contains a disallowed option: ${JSON.stringify(token)} (${describeRejection(token)})`,
      );
    }
  }

  return tokens;
}
