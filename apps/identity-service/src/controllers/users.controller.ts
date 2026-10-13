import type { NextFunction, Request, Response } from "express";
import type { UsersService } from "../services/users.service";

export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.usersService.create(req.body ?? {}, req.principal!);
      res.status(201).json({ data: user, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  list = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const users = await this.usersService.list(req.principal!);
      res.status(200).json({ data: users, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.usersService.getById(req.params.id, req.principal!);
      res.status(200).json({ data: user, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.usersService.update(req.params.id, req.body ?? {}, req.principal!);
      res.status(200).json({ data: user, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  updatePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { password } = req.body ?? {};
      const user = await this.usersService.update(req.principal!.userId, { password }, req.principal!);
      res.status(200).json({ data: user, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  disable = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const user = await this.usersService.disable(req.params.id, req.principal!);
      res.status(200).json({ data: user, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };
}
