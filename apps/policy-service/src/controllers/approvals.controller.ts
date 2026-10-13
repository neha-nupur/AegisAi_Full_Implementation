import type { NextFunction, Request, Response } from "express";
import type { ApprovalsService } from "../services/approvals.service";
import { isApprovalStatus } from "../repositories/approval-status.guard";

export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const approval = await this.approvalsService.getById(req.params.id, req.principal!);
      res.status(200).json({ data: approval, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const statusParam = req.query.status;
      const status = typeof statusParam === "string" && isApprovalStatus(statusParam) ? statusParam : undefined;
      const approvals = await this.approvalsService.list(req.principal!, status);
      res.status(200).json({ data: approvals, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  approve = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const approval = await this.approvalsService.approve(req.params.id, req.principal!, req.body?.reason ?? null);
      res.status(200).json({ data: approval, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  reject = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const approval = await this.approvalsService.reject(req.params.id, req.principal!, req.body?.reason ?? null);
      res.status(200).json({ data: approval, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };
}
