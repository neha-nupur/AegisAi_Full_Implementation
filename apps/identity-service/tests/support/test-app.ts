import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { HttpError, type ApiErrorBody } from "@aegisai/shared-types";
import { createIdentityApiRouter, type IdentityApiDependencies } from "../../src/routes/api.routes";

/**
 * A minimal standalone Express app for HTTP-level tests of this
 * service's business router. `apps/api` depends on this package (not
 * the other way around), so this service's own tests cannot reuse
 * `apps/api`'s `createApp()` — this reimplements just enough of its
 * error-handling contract (the `ApiErrorBody` envelope from
 * docs/api-conventions.md) to make HTTP-level assertions meaningful.
 * Test-only scaffolding, never imported by production code.
 */
export function buildTestApp(deps: IdentityApiDependencies): Express {
  const app = express();
  app.use(express.json());
  app.use(createIdentityApiRouter(deps));

  app.use((req: Request, res: Response) => {
    const body: ApiErrorBody = {
      error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}.`, traceId: "test" },
    };
    res.status(404).json(body);
  });

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    if (err instanceof HttpError) {
      const body: ApiErrorBody = {
        error: { code: err.code, message: err.message, details: err.details, traceId: "test" },
      };
      res.status(err.status).json(body);
      return;
    }
    const body: ApiErrorBody = {
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred.", traceId: "test" },
    };
    res.status(500).json(body);
  });

  return app;
}
