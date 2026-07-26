import {
  MAX_CODE_LENGTH,
  RunErrorResponseSchema,
  RunRequestSchema,
  RunResultSchema,
  type Language,
  type RunRequest,
  type RunResult,
  type TargetId,
} from "@qemu-playground/shared";

/**
 * Client for the one API endpoint, always called through a same-origin
 * relative path (docs/internal/contracts/run-protocol.md).
 */
export const RUN_ENDPOINT = "/api/run";

export interface RunInput {
  language: Language;
  target: TargetId;
  code: string;
  compileOptions: string;
}

/**
 * Either the Run produced a result (any of the four statuses, all HTTP 200),
 * or it could not be completed at all and we only have a reason to show.
 */
export type RunOutcome = { ok: true; result: RunResult } | { ok: false; message: string };

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

const defaultFetch: FetchLike = (input, init) => globalThis.fetch(input, init);

/** Builds a wire request, rejecting input the schema would refuse anyway. */
export function buildRunRequest(
  input: RunInput,
): { ok: true; request: RunRequest } | { ok: false; message: string } {
  if (input.code.trim() === "") {
    return { ok: false, message: "There is no code to run." };
  }
  if (input.code.length > MAX_CODE_LENGTH) {
    return {
      ok: false,
      message: `The code is ${input.code.length} characters, over the ${MAX_CODE_LENGTH} character limit.`,
    };
  }

  const options = input.compileOptions.trim();
  const candidate = {
    language: input.language,
    target: input.target,
    code: input.code,
    ...(options === "" ? {} : { compileOptions: options }),
  };

  const parsed = RunRequestSchema.safeParse(candidate);
  if (!parsed.success) {
    return { ok: false, message: "The request is not valid for this API." };
  }
  return { ok: true, request: parsed.data };
}

/** Reads an error-layer response body into a displayable message. */
export function describeErrorResponse(status: number, body: unknown): string {
  const parsed = RunErrorResponseSchema.safeParse(body);
  if (parsed.success) {
    return `${parsed.data.error.code}: ${parsed.data.error.message}`;
  }
  return `The API responded with HTTP ${status}.`;
}

export async function requestRun(
  input: RunInput,
  fetchImpl: FetchLike = defaultFetch,
): Promise<RunOutcome> {
  const built = buildRunRequest(input);
  if (!built.ok) {
    return built;
  }

  let response: Response;
  try {
    response = await fetchImpl(RUN_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(built.request),
    });
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    return { ok: false, message: `Could not reach the API: ${detail}` };
  }

  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }

  if (!response.ok) {
    return { ok: false, message: describeErrorResponse(response.status, body) };
  }

  const parsed = RunResultSchema.safeParse(body);
  if (!parsed.success) {
    return { ok: false, message: "The API returned an unrecognised result." };
  }
  return { ok: true, result: parsed.data };
}
