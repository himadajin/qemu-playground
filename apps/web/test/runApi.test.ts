import { MAX_CODE_LENGTH, type RunResult } from "@qemu-playground/shared";
import { describe, expect, it } from "vitest";
import {
  RUN_ENDPOINT,
  buildRunRequest,
  requestRun,
  type FetchLike,
  type RunInput,
} from "../src/lib/runApi";

const INPUT: RunInput = {
  language: "c",
  target: "rv64",
  code: "int main(void) { return 0; }",
  compileOptions: "",
};

const RESULT: RunResult = {
  status: "success",
  compileLog: "",
  compileLogTruncated: false,
  stdout: "hi\n",
  stdoutTruncated: false,
  stderr: "",
  stderrTruncated: false,
  exitCode: 0,
  assembly: { available: false },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

describe("run request construction", () => {
  it("omits compileOptions when blank", () => {
    const built = buildRunRequest(INPUT);
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    expect(built.request).toEqual({
      language: "c",
      target: "rv64",
      code: INPUT.code,
    });
  });

  it("trims compileOptions when present", () => {
    const built = buildRunRequest({ ...INPUT, compileOptions: "  -O2  " });
    expect(built.ok && built.request.compileOptions).toBe("-O2");
  });

  it("refuses empty code and oversized code before any request", () => {
    expect(buildRunRequest({ ...INPUT, code: "   \n" }).ok).toBe(false);
    expect(buildRunRequest({ ...INPUT, code: "x".repeat(MAX_CODE_LENGTH + 1) }).ok).toBe(false);
  });
});

describe("requestRun", () => {
  it("posts to the same-origin endpoint and returns the parsed result", async () => {
    const calls: Array<{ url: string; init?: RequestInit }> = [];
    const fetchImpl: FetchLike = (url, init) => {
      calls.push({ url, init });
      return Promise.resolve(jsonResponse(RESULT));
    };

    const outcome = await requestRun(INPUT, fetchImpl);

    expect(calls[0]?.url).toBe(RUN_ENDPOINT);
    expect(calls[0]?.init?.method).toBe("POST");
    expect(outcome).toEqual({ ok: true, result: RESULT });
  });

  it("keeps error-layer responses out of the result layer", async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(
        jsonResponse({ error: { code: "capacity_exceeded", message: "too busy" } }, 429),
      );

    const outcome = await requestRun(INPUT, fetchImpl);

    expect(outcome.ok).toBe(false);
    expect(outcome.ok === false && outcome.message).toContain("capacity_exceeded");
    expect(outcome.ok === false && outcome.message).toContain("too busy");
  });

  it("falls back to the HTTP status when the error body is unreadable", async () => {
    const fetchImpl: FetchLike = () =>
      Promise.resolve(new Response("<html>502</html>", { status: 502 }));

    const outcome = await requestRun(INPUT, fetchImpl);
    expect(outcome.ok === false && outcome.message).toContain("502");
  });

  it("reports transport failures as a Run that could not be completed", async () => {
    const fetchImpl: FetchLike = () => Promise.reject(new Error("network down"));

    const outcome = await requestRun(INPUT, fetchImpl);
    expect(outcome.ok === false && outcome.message).toContain("network down");
  });

  it("rejects a 200 body that does not match the result schema", async () => {
    const fetchImpl: FetchLike = () => Promise.resolve(jsonResponse({ status: "success" }));

    const outcome = await requestRun(INPUT, fetchImpl);
    expect(outcome.ok).toBe(false);
  });
});
