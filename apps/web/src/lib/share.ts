import {
  LanguageSchema,
  TargetIdSchema,
  type Language,
  type TargetId,
} from "@qemu-playground/shared";
import {
  compressToEncodedURIComponent,
  decompressFromEncodedURIComponent,
} from "lz-string";

/**
 * Share URLs carry the whole form state in the URL fragment. Nothing is
 * stored server-side (design.md), so the fragment is the only transport, and
 * because it is a fragment the payload never reaches the server at all.
 */

/**
 * Practical upper bound for a shareable URL. Browsers and chat clients start
 * mangling links well before their theoretical limits; 2000 characters is the
 * commonly quoted safe ceiling. Exceeding it is an error: a share URL is
 * never silently truncated (design.md).
 */
export const MAX_SHARE_URL_LENGTH = 2000;

/** Fragment key holding the compressed payload: `#s=<payload>`. */
export const SHARE_HASH_KEY = "s";

/** Bumped only if the payload layout changes incompatibly. */
const SHARE_FORMAT_VERSION = 1;

export interface ShareState {
  language: Language;
  target: TargetId;
  code: string;
  compileOptions: string;
}

interface SharePayload {
  v: number;
  l: string;
  t: string;
  c: string;
  o: string;
}

/**
 * Compresses the form state into a fragment-safe string.
 *
 * `compressToEncodedURIComponent` emits only characters that are legal in a
 * URL fragment, so the result is embedded verbatim — no percent-encoding, and
 * therefore no `+`-means-space ambiguity on the way back.
 */
export function encodeShareState(state: ShareState): string {
  const payload: SharePayload = {
    v: SHARE_FORMAT_VERSION,
    l: state.language,
    t: state.target,
    c: state.code,
    o: state.compileOptions,
  };
  return compressToEncodedURIComponent(JSON.stringify(payload));
}

/** Inverse of {@link encodeShareState}. Returns null for anything unusable. */
export function decodeShareState(payload: string): ShareState | null {
  if (payload === "") {
    return null;
  }

  let json: string | null;
  try {
    json = decompressFromEncodedURIComponent(payload);
  } catch {
    return null;
  }
  if (json === null || json === "") {
    return null;
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as Partial<SharePayload>;
  if (candidate.v !== SHARE_FORMAT_VERSION) {
    return null;
  }

  const language = LanguageSchema.safeParse(candidate.l);
  const target = TargetIdSchema.safeParse(candidate.t);
  if (!language.success || !target.success) {
    return null;
  }
  if (typeof candidate.c !== "string") {
    return null;
  }

  return {
    language: language.data,
    target: target.data,
    code: candidate.c,
    compileOptions: typeof candidate.o === "string" ? candidate.o : "",
  };
}

export type ShareUrlResult =
  | { ok: true; url: string }
  | { ok: false; reason: "too_long"; length: number; limit: number };

/**
 * Builds the share URL for `state`, relative to the page's current location.
 * Fails instead of shortening when the result would exceed the length limit.
 */
export function buildShareUrl(
  baseUrl: string,
  state: ShareState,
  limit: number = MAX_SHARE_URL_LENGTH,
): ShareUrlResult {
  const url = new URL(baseUrl);
  url.hash = `${SHARE_HASH_KEY}=${encodeShareState(state)}`;
  const href = url.toString();

  if (href.length > limit) {
    return { ok: false, reason: "too_long", length: href.length, limit };
  }
  return { ok: true, url: href };
}

/**
 * Reads the share payload out of a `location.hash` value. Parsed by hand
 * rather than through URLSearchParams, which would turn the payload's `+`
 * characters into spaces.
 */
export function readShareStateFromHash(hash: string): ShareState | null {
  const raw = hash.startsWith("#") ? hash.slice(1) : hash;
  const prefix = `${SHARE_HASH_KEY}=`;
  if (!raw.startsWith(prefix)) {
    return null;
  }
  return decodeShareState(raw.slice(prefix.length));
}
