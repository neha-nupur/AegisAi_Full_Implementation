import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { randomUUID } from "node:crypto";
import { HttpError, type ApiErrorBody } from "@aegisai/shared-types";
import { createPolicyApiRouter, type PolicyApiDependencies } from "../../src/routes/api.routes";

/** Same convention as gateway-service's `tests/support/test-app.ts`. Test-only. */
export function buildTestApp(deps: PolicyApiDependencies): Express {
  const app = express();
  app.use(express.json());
  app.use((req: Request, _res: Response, next: NextFunction) => {
    req.correlationId = req.header("x-correlation-id") ?? randomUUID();
    next();
  });
  app.use(createPolicyApiRouter(deps));

  app.use((req: Request, res: Response) => {
    const body: ApiErrorBody = {
      error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}.`, traceId: req.correlationId ?? "test" },
    };
    res.status(404).json(body);
  });

  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    const traceId = req.correlationId ?? "test";
    if (err instanceof HttpError) {
      const body: ApiErrorBody = { error: { code: err.code, message: err.message, details: err.details, traceId } };
      res.status(err.status).json(body);
      return;
    }
    const body: ApiErrorBody = { error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", traceId } };
    res.status(500).json(body);
  });

  return app;
}
