import type { NextFunction, Request, Response } from "express";
import type { OrganizationsService } from "../services/organizations.service";

export class OrganizationsController {
  constructor(private readonly organizationsService: OrganizationsService) {}

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organization = await this.organizationsService.getById(req.params.id, req.principal!);
      res.status(200).json({ data: organization, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const organization = await this.organizationsService.update(req.params.id, req.body ?? {}, req.principal!);
      res.status(200).json({ data: organization, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };
}
