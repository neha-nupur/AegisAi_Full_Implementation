import type { CorrelationId } from "@aegisai/shared-types";

/**
 * `correlationId` is assigned by `apps/api/src/middleware/correlationId.ts`
 * before any mounted service's routes run, but that middleware lives
 * in `apps/api`, which this package does not (and must not) depend on
 * — so it is redeclared here as optional. In production it is always
 * set by the time a request reaches this service's controllers; this
 * package's own standalone tests, which mount routers on a bare
 * `express()` app, are the case where it is legitimately absent.
 */
declare module "express-serve-static-core" {
  interface Request {
    correlationId?: CorrelationId;
  }
}
