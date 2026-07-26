import {
  MAX_CODE_LENGTH,
  RunRequestSchema,
  type RunErrorCode,
  type RunErrorResponse,
} from "@qemu-playground/shared";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyReply } from "fastify";
import { z } from "zod";
import { InvalidCompileOptionsError } from "./compile-options.js";
import { loadConfig, type ApiConfig } from "./config.js";
import { createRunService, type RunService } from "./run-service.js";
import { createDockerRunner, RunnerError, type Runner } from "./runner/index.js";

/**
 * Fastify application factory.
 *
 * Errors come in two layers that never mix (see
 * docs/internal/contracts/run-protocol.md): the outcome of a Run that actually
 * happened is always HTTP 200 with a `RunResult` body, while a Run that could
 * not be attempted is an HTTP 4xx/5xx with a `RunErrorResponse` body.
 */

const STATUS_BY_ERROR_CODE: Record<RunErrorCode, number> = {
  invalid_request: 400,
  capacity_exceeded: 429,
  internal_error: 500,
};

function sendError(reply: FastifyReply, code: RunErrorCode, message: string): FastifyReply {
  const body: RunErrorResponse = { error: { code, message } };
  return reply.status(STATUS_BY_ERROR_CODE[code]).send(body);
}

/**
 * Counts in-flight Runs. Anything over the limit is rejected immediately —
 * there is deliberately no queue.
 */
function createConcurrencyLimiter(limit: number) {
  let active = 0;
  return {
    tryAcquire(): boolean {
      if (active >= limit) return false;
      active += 1;
      return true;
    },
    release(): void {
      active -= 1;
    },
  };
}

export interface CreateAppOptions {
  config?: ApiConfig;
  /** Injection point for tests; defaults to the real Docker-backed runner. */
  runner?: Runner;
  logger?: boolean;
}

export function createApp(options: CreateAppOptions = {}): FastifyInstance {
  const config = options.config ?? loadConfig();
  const runner = options.runner ?? createDockerRunner(config);
  const runService: RunService = createRunService(config, runner);
  const limiter = createConcurrencyLimiter(config.maxConcurrentRuns);

  const app = Fastify({
    logger: options.logger ?? true,
    // Room for MAX_CODE_LENGTH of source plus JSON escaping and the other fields.
    bodyLimit: MAX_CODE_LENGTH * 4,
  });

  app.get("/api/healthz", async () => ({ status: "ok" }));

  app.post("/api/run", async (request, reply) => {
    const parsed = RunRequestSchema.safeParse(request.body);
    if (!parsed.success) {
      return sendError(reply, "invalid_request", z.prettifyError(parsed.error));
    }

    if (!limiter.tryAcquire()) {
      return sendError(
        reply,
        "capacity_exceeded",
        `Too many runs in flight (limit ${config.maxConcurrentRuns}). Try again in a moment.`,
      );
    }

    try {
      return await runService.run(parsed.data);
    } catch (error) {
      if (error instanceof InvalidCompileOptionsError) {
        return sendError(reply, "invalid_request", error.message);
      }
      request.log.error({ err: error }, "run failed");
      const message =
        error instanceof RunnerError ? error.message : "The run could not be completed.";
      return sendError(reply, "internal_error", message);
    } finally {
      limiter.release();
    }
  });

  app.setNotFoundHandler((request, reply) =>
    sendError(reply, "invalid_request", `No such route: ${request.method} ${request.url}`),
  );

  // Normalises Fastify's own failures (malformed JSON, wrong content type,
  // oversized body) into the protocol's error shape.
  app.setErrorHandler((error: FastifyError, request, reply) => {
    const status = error.statusCode ?? 500;
    if (status >= 400 && status < 500) {
      return sendError(reply, "invalid_request", error.message);
    }
    request.log.error({ err: error }, "unhandled error");
    return sendError(reply, "internal_error", "The run could not be completed.");
  });

  return app;
}
