import { compressToEncodedURIComponent } from "lz-string";
import { describe, expect, it } from "vitest";
import {
  MAX_SHARE_URL_LENGTH,
  buildShareUrl,
  decodeShareState,
  encodeShareState,
  readShareStateFromHash,
  type ShareState,
} from "../src/lib/share";

const BASE_URL = "https://play.example.com/";

const STATE: ShareState = {
  language: "asm",
  target: "aarch64",
  code: '    mov x8, #93\n    // exit\n    svc #0\n"quoted+chars"\n',
  compileOptions: "-O2 -Wall",
};

describe("share state encoding", () => {
  it("round-trips through the compressed payload", () => {
    expect(decodeShareState(encodeShareState(STATE))).toEqual(STATE);
  });

  it("round-trips through a full share URL", () => {
    const built = buildShareUrl(BASE_URL, STATE);
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const hash = new URL(built.url).hash;
    expect(readShareStateFromHash(hash)).toEqual(STATE);
  });

  it("survives payloads containing URL-significant characters", () => {
    // lz-string's URI-safe alphabet includes "+", which URLSearchParams would
    // silently turn into a space.
    const code = Array.from({ length: 400 }, (_, i) => `x${i} += 1;`).join("\n");
    const state: ShareState = { ...STATE, code };
    const payload = encodeShareState(state);
    expect(payload).toMatch(/\+/);
    expect(readShareStateFromHash(`#s=${payload}`)).toEqual(state);
  });

  it("keeps an empty compileOptions round-tripping as empty", () => {
    const state: ShareState = { ...STATE, compileOptions: "" };
    expect(decodeShareState(encodeShareState(state))).toEqual(state);
  });

  it("rejects garbage, foreign hashes and unknown enum values", () => {
    expect(decodeShareState("")).toBeNull();
    expect(decodeShareState("not-a-payload")).toBeNull();
    expect(readShareStateFromHash("")).toBeNull();
    expect(readShareStateFromHash("#other=abc")).toBeNull();
    expect(
      decodeShareState(encodeShareStateRaw({ v: 1, l: "rust", t: "rv64", c: "x", o: "" })),
    ).toBeNull();
    expect(
      decodeShareState(encodeShareStateRaw({ v: 1, l: "c", t: "mips", c: "x", o: "" })),
    ).toBeNull();
    expect(
      decodeShareState(encodeShareStateRaw({ v: 99, l: "c", t: "rv64", c: "x", o: "" })),
    ).toBeNull();
  });
});

describe("share URL length limit", () => {
  it("refuses to build a URL past the limit instead of truncating", () => {
    const state: ShareState = {
      ...STATE,
      // Random-ish text so lz-string cannot compress it away.
      code: Array.from({ length: 4000 }, (_, i) => `volatile int v${i} = ${i * 7919};`).join("\n"),
    };

    const built = buildShareUrl(BASE_URL, state);
    expect(built.ok).toBe(false);
    if (built.ok) {
      return;
    }
    expect(built.reason).toBe("too_long");
    expect(built.limit).toBe(MAX_SHARE_URL_LENGTH);
    expect(built.length).toBeGreaterThan(MAX_SHARE_URL_LENGTH);
  });

  it("accepts a URL exactly at the limit", () => {
    const built = buildShareUrl(BASE_URL, STATE);
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const exact = buildShareUrl(BASE_URL, STATE, built.url.length);
    expect(exact.ok).toBe(true);
    const oneShort = buildShareUrl(BASE_URL, STATE, built.url.length - 1);
    expect(oneShort.ok).toBe(false);
  });

  it("replaces an existing fragment rather than appending to it", () => {
    const built = buildShareUrl(`${BASE_URL}#s=stale`, STATE);
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.url.match(/#/g)).toHaveLength(1);
    expect(readShareStateFromHash(new URL(built.url).hash)).toEqual(STATE);
  });
});

/** Builds a payload from an arbitrary object, for the rejection cases above. */
function encodeShareStateRaw(payload: unknown): string {
  return compressToEncodedURIComponent(JSON.stringify(payload));
}
