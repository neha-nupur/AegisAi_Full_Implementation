import type { NextFunction, Request, Response } from "express";
import { MongoSecurityEventsRepository } from "../repositories/security-events.repository";
import type { SecurityEventSeverity } from "../types";

export class SecurityEventsController {
  constructor(private readonly securityEventsRepo = new MongoSecurityEventsRepository()) {}

  /** Phase 11 fix: try/catch + `next(err)` — see TracesController's doc comment for why this matters. */
  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const actor = req.principal!;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const cursor = req.query.cursor as string | undefined;
      const severity = req.query.severity as SecurityEventSeverity | undefined;

      const result = await this.securityEventsRepo.listByOrganization(actor.organizationId, severity, limit, cursor);
      res.json({ data: result });
    } catch (err) {
      next(err);
    }
  };
}
