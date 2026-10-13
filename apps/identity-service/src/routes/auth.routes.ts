import { Router } from "express";
import { AuthController } from "../controllers/auth.controller";
import type { AuthService } from "../services/auth.service";
import { authenticateJWT } from "../middleware";

export function buildAuthRoutes(authService: AuthService): Router {
  const router = Router();
  const controller = new AuthController(authService);

  // Public auth routes
  router.post("/auth/login", controller.login);
  router.post("/auth/signup", controller.signup);
  router.post("/auth/verify-email", controller.verifyEmail);
  router.post("/auth/resend-verification", controller.resendVerification);
  router.post("/auth/forgot-password", controller.forgotPassword);
  router.post("/auth/reset-password", controller.resetPassword);

  // Protected auth routes
  router.post("/auth/change-password", authenticateJWT, controller.changePassword);

  return router;
}
