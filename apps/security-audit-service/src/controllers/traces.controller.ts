import type { NextFunction, Request, Response } from "express";
import { MongoTraceRepository } from "../repositories/traces.repository";
import { MongoAuditEventsRepository } from "../repositories/audit-events.repository";
import { HttpError } from "@aegisai/shared-types";

export class TracesController {
  constructor(
    private readonly tracesRepo = new MongoTraceRepository(),
    private readonly auditEventsRepo = new MongoAuditEventsRepository()
  ) {}

  /**
   * Phase 11 fix: every method here now has a try/catch forwarding to
   * `next(err)`. Express 4 does not automatically catch a rejected
   * promise from an `async` route handler (that's an Express 5
   * feature) — an uncaught throw here previously became an unhandled
   * rejection with no response ever sent, hanging the request rather
   * than returning e.g. `404 TRACE_NOT_FOUND`. Matches the
   * try/catch-and-`next` convention every other service's controllers
   * already use (e.g. `apps/gateway-service/src/controllers/ai-requests.controller.ts`).
   */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.principal!;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const cursor = req.query.cursor as string | undefined;

      const result = await this.tracesRepo.listByOrganization(actor.organizationId, limit, cursor);
      
      await Promise.all(result.items.map(async (trace) => {
        trace.events = await this.auditEventsRepo.findByTraceId(trace.id);
      }));

      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };

  get = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.principal!;
      const traceId = req.params.traceId;

      const trace = await this.tracesRepo.findByTraceId(traceId);
      if (!trace || trace.organizationId !== actor.organizationId) {
        throw new HttpError(404, "TRACE_NOT_FOUND", "Trace not found");
      }

      const events = await this.auditEventsRepo.findByTraceId(traceId);
      trace.events = events;

      res.json({ data: trace });
    } catch (err) {
      next(err);
    }
  };
}
