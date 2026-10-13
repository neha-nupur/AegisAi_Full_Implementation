import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { HttpError, type ApiErrorBody } from "@aegisai/shared-types";
import { createGatewayApiRouter, type GatewayApiDependencies } from "../../src/routes/api.routes";

/**
 * A minimal standalone Express app for HTTP-level tests of this
 * service's business router. Same convention as
 * `apps/identity-service/tests/support/test-app.ts`: `apps/api`
 * depends on this package (not the other way around), so this
 * service's own tests reimplement just enough of the shared
 * error/correlation-ID contract to make HTTP-level assertions
 * meaningful. Test-only scaffolding, never imported by production code.
 */
export function buildTestApp(deps: GatewayApiDependencies): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.correlationId = req.header("x-correlation-id") ?? randomUUID();
    next();
  });
  app.use(createGatewayApiRouter(deps));

  app.use((req: Request, res: Response) => {
    const body: ApiErrorBody = {
      error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}.`, traceId: req.correlationId ?? "test" },
    };
    res.status(404).json(body);
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const traceId = req.correlationId ?? "test";
    if (err instanceof HttpError) {
      const body: ApiErrorBody = {
        error: { code: err.code, message: err.message, details: err.details, traceId },
      };
      res.status(err.status).json(body);
      return;
    }
    const body: ApiErrorBody = {
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", traceId },
    };
    res.status(500).json(body);
  });

  return app;
}
