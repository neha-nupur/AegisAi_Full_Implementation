import type { NextFunction, Request, Response } from "express";
import { HttpError, type ApiErrorBody } from "@aegisai/shared-types";

/**
 * `HttpError` itself now lives in `@aegisai/shared-types` (Phase 2)
 * so that every service — not just `apps/api` — can throw a typed
 * HTTP error and have it rendered consistently by the central
 * handler below. Re-exported here so existing imports of
 * `HttpError` from this module keep working unchanged.
 */
export { HttpError };

/**
 * Central error-handling middleware. Every error, from any route or
 * downstream middleware — including routes owned by any of the six
 * mounted services — is normalized into the one error envelope shape
 * used across all AegisAI services (see docs/api-conventions.md).
 *
 * Domain-specific errors (PolicyDenied, ProviderUnavailable, etc.)
 * are added by later phases as HttpError subclasses or mapped error
 * codes, without changing this envelope shape.
 */
export function errorHandler(
  err: any,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const traceId = req.correlationId ?? "unknown";

  if (err instanceof HttpError) {
    const body: ApiErrorBody = {
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
        traceId,
      },
    };
    res.status(err.status).json(body);
    return;
  }

  // Handle body-parser errors (like malformed XML/JSON which set err.status)
  if (err.status && err.status >= 400 && err.status < 500) {
    const body: ApiErrorBody = {
      error: {
        code: "VALIDATION_ERROR",
        message: err.message || "Invalid request payload",
        traceId,
      },
    };
    res.status(err.status).json(body);
    return;
  }

  req.log?.error({ err }, "Unhandled error");

  const body: ApiErrorBody = {
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred.",
      traceId,
    },
  };
  res.status(500).json(body);
}

/** 404 handler, normalized to the same error envelope. */
export function notFoundHandler(req: Request, res: Response): void {
  const body: ApiErrorBody = {
    error: {
      code: "NOT_FOUND",
      message: `No route for ${req.method} ${req.path}.`,
      traceId: req.correlationId ?? "unknown",
    },
  };
  res.status(404).json(body);
}
