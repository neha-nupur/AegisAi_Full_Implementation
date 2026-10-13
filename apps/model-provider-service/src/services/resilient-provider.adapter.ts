import { ProviderAdapter, GenerateRequest, GenerateResponse } from "./provider-adapter.interface";
import { Provider, Model, ProviderHealthStatus } from "../types";
import {

  CircuitBreakerPolicy,
  RetryPolicy,
  TimeoutPolicy,
  ExponentialBackoff,
  handleWhen,
  handleAll,
  circuitBreaker,
  retry,
  timeout,
  ConsecutiveBreaker,
  TimeoutStrategy,
  wrap,
  isBrokenCircuitError
} from "cockatiel";
import { HttpError } from "@aegisai/shared-types";

const logger = console;

/**
 * `cockatiel@3.2.1`'s own `isTaskCancelledError` helper is broken —
 * it checks `'isBulkheadRejectedError' in e` instead of
 * `'isTaskCancelledError' in e` (see
 * `node_modules/cockatiel/dist/errors/Errors.js`), so it always
 * returns false for a real timeout, silently misclassifying every
 * provider timeout as a generic `PROVIDER_ERROR` (502) instead of
 * `PROVIDER_TIMEOUT` (504). Found and fixed during Phase 11
 * hardening — verified against the same library bug independently
 * confirmed in `apps/identity-service/src/integrations/soap/legacy-employee.client.ts`.
 * `TaskCancelledError` itself correctly sets
 * `this.isTaskCancelledError = true` in its constructor, so this
 * checks that marker property directly instead of trusting the
 * library's own (buggy) type guard.
 */
function isTimeoutError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "isTaskCancelledError" in err && (err as { isTaskCancelledError?: unknown }).isTaskCancelledError === true;
}

export interface ResilienceMetadata {
  attempts: number;
  circuitState: "Closed" | "Open" | "HalfOpen";
}

export class ResilientProviderAdapter implements ProviderAdapter {
  private readonly retryPolicy: RetryPolicy;
  private readonly circuitBreakerPolicy: CircuitBreakerPolicy;
  private readonly timeoutPolicy: TimeoutPolicy;
  private readonly resiliencePolicy: any;

  constructor(private readonly innerAdapter: ProviderAdapter) {
    // 1. Timeout Policy: 30 seconds
    this.timeoutPolicy = timeout(30000, TimeoutStrategy.Aggressive);

    // 2. Circuit Breaker Policy
    this.circuitBreakerPolicy = circuitBreaker(handleAll, {
      halfOpenAfter: 30000,
      breaker: new ConsecutiveBreaker(5),
    });

    this.circuitBreakerPolicy.onBreak(() => {
      logger.warn({ msg: "Circuit breaker opened", adapter: this.constructor.name });
    });
    this.circuitBreakerPolicy.onHalfOpen(() => {
      logger.info({ msg: "Circuit breaker half-open", adapter: this.constructor.name });
    });
    this.circuitBreakerPolicy.onSuccess(() => {
      if (this.circuitBreakerPolicy.state === 0) { // State.Closed is 0
        logger.info({ msg: "Circuit breaker closed", adapter: this.constructor.name });
      }
    });

    // 3. Retry Policy
    const retryFilter = handleWhen((err: any) => {
      if (err instanceof HttpError) {
        const status = (err as any).status;
        return status === 429 || status >= 500;
      }
      return true;
    });

    this.retryPolicy = retry(retryFilter, {
      maxAttempts: 3,
      backoff: new ExponentialBackoff({ maxDelay: 5000, initialDelay: 500 }),
    });

    this.retryPolicy.onRetry((reason) => {
      logger.warn({
        msg: "Retrying outbound call",
        delay: reason.delay,
        attempt: reason.attempt,
        error: (reason as any).exception?.message || (reason as any).error?.message || "Unknown error"
      });
    });

    // 4. Wrap them together (Outer: Circuit Breaker -> Retry -> Timeout :Inner)
    this.resiliencePolicy = wrap(this.circuitBreakerPolicy, this.retryPolicy, this.timeoutPolicy);
  }

  private getCircuitState(): ResilienceMetadata["circuitState"] {
    switch (this.circuitBreakerPolicy.state) {
      case 0: return "Closed";
      case 1: return "Open";
      case 2: return "HalfOpen";
      default: return "Closed";
    }
  }

  async generate(request: GenerateRequest, provider: Provider, model: Model): Promise<GenerateResponse & { resilience?: ResilienceMetadata }> {
    let attempts = 1;
    
    // Create a local retry event listener for this specific call to track attempts accurately
    const retryListener = this.retryPolicy.onRetry(() => {
      attempts++;
    });

    try {
      const result = await this.resiliencePolicy.execute(() =>
        this.innerAdapter.generate(request, provider, model)
      );
      
      retryListener.dispose();
      
      return {
        ...result,
        resilience: {
          attempts,
          circuitState: this.getCircuitState()
        }
      };
    } catch (err: any) {
      retryListener.dispose();
      
      const resilience: ResilienceMetadata = { attempts, circuitState: this.getCircuitState() };
      
      if (isTimeoutError(err)) {
        throw new HttpError(504, "PROVIDER_TIMEOUT", "Provider took too long to respond", { providerId: provider.id, resilience });
      }
      if (isBrokenCircuitError(err)) {
         throw new HttpError(503, "PROVIDER_CIRCUIT_OPEN", "Provider is temporarily unavailable due to a tripped circuit breaker", { providerId: provider.id, resilience });
      }
      if (err instanceof HttpError) {
        throw new HttpError(err.status, err.code, err.message, {
          ...(err.details || {}),
          resilience
        });
      }
      throw new HttpError(502, "PROVIDER_ERROR", err.message || "Unknown error calling provider", { providerId: provider.id, resilience });
    }
  }

  async healthCheck(provider: Provider): Promise<ProviderHealthStatus> {
    try {
      return await this.timeoutPolicy.execute(() => this.innerAdapter.healthCheck(provider));
    } catch (err: any) {
      logger.error({ msg: "Health check failed", providerId: provider.id, err });
      return "unhealthy";
    }
  }

  getCapabilities(): string[] {
    return this.innerAdapter.getCapabilities();
  }
}
