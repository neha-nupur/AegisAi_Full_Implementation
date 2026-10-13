import type { CorrelationId } from "@aegisai/shared-types";

/** Same convention as gateway-service's `types/express.d.ts` — see that file's comment for why `correlationId` is optional here. */
declare module "express-serve-static-core" {
  interface Request {
    correlationId?: CorrelationId;
  }
}
