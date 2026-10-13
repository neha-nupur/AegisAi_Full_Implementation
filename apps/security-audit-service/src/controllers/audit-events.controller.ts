import type { NextFunction, Request, Response } from "express";
import { MongoAuditEventsRepository } from "../repositories/audit-events.repository";

export class AuditEventsController {
  constructor(private readonly auditEventsRepo = new MongoAuditEventsRepository()) {}

  /** Phase 11 fix: try/catch + `next(err)` — see TracesController's doc comment for why this matters. */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.principal!;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const cursor = req.query.cursor as string | undefined;
      const traceId = req.query.traceId as string | undefined;

      if (traceId) {
        const events = await this.auditEventsRepo.findByTraceId(traceId);
        // In a real system, we'd need to verify the trace belongs to the org.
        // Assuming events themselves carry organizationId which we could check,
        // or we just filter by it in the repo. For simplicity, we just filter post-query.
        const orgEvents = events.filter((e) => e.organizationId === actor.organizationId);
        res.json({ data: { items: orgEvents, nextCursor: null } });
        return;
      }

      const result = await this.auditEventsRepo.listByOrganization(actor.organizationId, limit, cursor);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
