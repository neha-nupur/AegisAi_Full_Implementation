import type { NextFunction, Request, Response } from "express";
import type { LegacyEmployeeClient } from "../integrations/soap/legacy-employee.client";

/**
 * Demonstration endpoint for the SOAP connector (Phase 10). This is
 * intentionally the *only* place the SOAP connector is called from —
 * per the Phase 10 instructions, SOAP must never become a dependency
 * of normal AI request processing.
 */
export class LegacyEmployeeController {
  constructor(private readonly client: LegacyEmployeeClient) {}

  checkEmployee = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const record = await this.client.checkEmployee(req.params.employeeId, req.correlationId ?? "unknown");
      res.status(200).json({ data: record, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };
}
