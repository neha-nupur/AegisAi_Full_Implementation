import type { AuthenticatedPrincipal } from "@aegisai/identity-service";

declare module "express-serve-static-core" {
  interface Request {
    principal?: AuthenticatedPrincipal;
  }
}

