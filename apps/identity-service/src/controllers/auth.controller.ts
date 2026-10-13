import type { NextFunction, Request, Response } from "express";
import type { AuthService } from "../services/auth.service";

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password } = req.body ?? {};
      const result = await this.authService.login(email, password);
      res.status(200).json({ data: result, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  signup = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, password, role } = req.body ?? {};
      const result = await this.authService.signup(email, password, role);
      res.status(201).json({ data: result, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  verifyEmail = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token } = req.body ?? {};
      const result = await this.authService.verifyEmail(token);
      res.status(200).json({ data: result, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  resendVerification = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body ?? {};
      const result = await this.authService.resendVerification(email);
      res.status(200).json({ data: result, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  forgotPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email } = req.body ?? {};
      const result = await this.authService.forgotPassword(email);
      res.status(200).json({ data: result, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { token, newPassword, confirmPassword } = req.body ?? {};
      const result = await this.authService.resetPassword(token, newPassword, confirmPassword);
      res.status(200).json({ data: result, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };

  changePassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const principal = (req as any).principal;
      if (!principal?.userId) {
        res.status(401).json({ error: { code: "UNAUTHORIZED", message: "Authentication required." } });
        return;
      }
      const { currentPassword, newPassword, confirmPassword } = req.body ?? {};
      const result = await this.authService.changePassword(principal.userId, currentPassword, newPassword, confirmPassword);
      res.status(200).json({ data: result, traceId: req.correlationId });
    } catch (err) {
      next(err);
    }
  };
}
