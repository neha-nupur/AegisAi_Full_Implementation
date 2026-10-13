import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import type { CorrelationId } from "@aegisai/shared-types";

/** Express augmentation: every request carries a correlation ID once this middleware runs. */
declare module "express-serve-static-core" {
  interface Request {
    correlationId: CorrelationId;
  }
}

const HEADER_NAME = "x-correlation-id";

/**
 * Assigns a correlation ID to every request — reusing one supplied by an
 * upstream caller if present, otherwise generating a new one. The ID is
 * echoed back on the response so callers (and this gateway's own
 * downstream service calls, from Phase 3 onward) can thread it through
 * the whole request lifecycle per the observability rule.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.header(HEADER_NAME);
  const correlationId: CorrelationId =
    incoming && incoming.trim().length > 0 ? incoming : randomUUID();

  req.correlationId = correlationId;
  res.setHeader(HEADER_NAME, correlationId);
  next();
}
