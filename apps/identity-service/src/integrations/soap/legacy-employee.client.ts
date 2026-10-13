import * as soap from "soap";
import {
  circuitBreaker,
  ConsecutiveBreaker,
  ExponentialBackoff,
  handleAll,
  isBrokenCircuitError,
  retry,
  timeout,
  TimeoutStrategy,
  wrap,
  type CircuitBreakerPolicy,
  type RetryPolicy,
  type TimeoutPolicy,
} from "cockatiel";
import { HttpError } from "@aegisai/shared-types";
import type { LegacyEmployeeRecord } from "./legacy-employee.types";

/**
 * `cockatiel@3.2.1`'s own `isTaskCancelledError` helper is broken —
 * it checks `'isBulkheadRejectedError' in e` instead of
 * `'isTaskCancelledError' in e` (see
 * `node_modules/cockatiel/dist/errors/Errors.js`), so it always
 * returns false for a real timeout. `TaskCancelledError` itself
 * correctly sets `this.isTaskCancelledError = true` in its
 * constructor, so this checks that marker property directly instead
 * of trusting the library's own (buggy) type guard. Verified live
 * against a real 10s-delayed SOAP response — see
 * `tests/legacy-employee.client.test.ts`'s timeout test.
 */
function isTimeoutError(err: unknown): boolean {
  return typeof err === "object" && err !== null && "isTaskCancelledError" in err && (err as { isTaskCancelledError?: unknown }).isTaskCancelledError === true;
}

/** Structural logger interface — same pattern used across every service's optional audit logger. */
export interface SoapLogger {
  info(obj: Record<string, unknown>, msg?: string): void;
  warn(obj: Record<string, unknown>, msg?: string): void;
  error(obj: Record<string, unknown>, msg?: string): void;
}

const NOOP_LOGGER: SoapLogger = { info: () => {}, warn: () => {}, error: () => {} };

/**
 * Connector to the legacy `CheckLegacyEmployee` SOAP service
 * (`soap-mock/`, Phase 10). Demonstrates: reading a WSDL, making a
 * real SOAP request, applying timeout/retry/circuit breaker (same
 * `cockatiel` library and shape as
 * `apps/model-provider-service/src/services/resilient-provider.adapter.ts`'s
 * Phase 7 resilience wrapper — deliberately a *separate*, smaller
 * policy here, not a shared import: the SOAP connector's timeout
 * (5s) and retry budget are tuned for a same-network legacy call,
 * not an external AI provider's), structured logging, and
 * correlation ID propagation (as a SOAP header, so it travels with
 * the request into the legacy system itself, not just in our own logs).
 *
 * Per the Phase 10 instructions, SOAP is never a dependency of normal
 * AI request processing — this connector is only ever called from
 * `GET /v1/legacy-employees/:employeeId`
 * (`routes/legacy-employee.routes.ts`), a standalone demonstration
 * endpoint. If `soap-mock` is down, that one endpoint fails; nothing
 * else in the Gateway's request flow is affected.
 */
export class LegacyEmployeeClient {
  private clientPromise?: Promise<soap.Client>;
  private readonly circuitBreakerPolicy: CircuitBreakerPolicy;
  private readonly retryPolicy: RetryPolicy;
  private readonly timeoutPolicy: TimeoutPolicy;
  private readonly resiliencePolicy: ReturnType<typeof wrap>;

  constructor(
    private readonly wsdlUrl: string,
    private readonly logger: SoapLogger = NOOP_LOGGER
  ) {
    this.timeoutPolicy = timeout(5_000, TimeoutStrategy.Aggressive);

    this.circuitBreakerPolicy = circuitBreaker(handleAll, {
      halfOpenAfter: 15_000,
      breaker: new ConsecutiveBreaker(5),
    });
    this.circuitBreakerPolicy.onBreak(() => this.logger.warn({ connector: "LegacyEmployeeClient" }, "Circuit breaker opened"));
    this.circuitBreakerPolicy.onHalfOpen(() => this.logger.info({ connector: "LegacyEmployeeClient" }, "Circuit breaker half-open"));
    this.circuitBreakerPolicy.onSuccess(() => {
      if (this.circuitBreakerPolicy.state === 0) {
        this.logger.info({ connector: "LegacyEmployeeClient" }, "Circuit breaker closed");
      }
    });

    // Only retry transient failures — a well-formed SOAP fault
    // returned for a known-bad input is not one; here every
    // synchronous throw from the mock (see soap-mock/server/index.js)
    // represents a transient legacy-system failure, so this retries
    // everything the circuit breaker lets through.
    this.retryPolicy = retry(handleAll, { maxAttempts: 3, backoff: new ExponentialBackoff({ initialDelay: 200, maxDelay: 2_000 }) });
    this.retryPolicy.onRetry((reason) =>
      this.logger.warn(
        { connector: "LegacyEmployeeClient", attempt: reason.attempt, delay: reason.delay, error: describeRetryReason(reason) },
        "Retrying legacy SOAP call"
      )
    );

    this.resiliencePolicy = wrap(this.circuitBreakerPolicy, this.retryPolicy, this.timeoutPolicy);
  }

  /** Loads and caches the SOAP client (parses the WSDL once, not per call). */
  private getClient(): Promise<soap.Client> {
    if (!this.clientPromise) {
      this.clientPromise = soap.createClientAsync(`${this.wsdlUrl}/legacy-employee?wsdl`, {
        endpoint: `${this.wsdlUrl}/legacy-employee`,
      });
      // If client creation itself fails, don't cache the rejection —
      // let the next call try again (e.g. soap-mock was still starting up).
      this.clientPromise.catch(() => {
        this.clientPromise = undefined;
      });
    }
    return this.clientPromise;
  }

  async checkEmployee(employeeId: string, correlationId: string): Promise<LegacyEmployeeRecord> {
    try {
      const result = await this.resiliencePolicy.execute(async (): Promise<LegacyEmployeeRecord> => {
        const client = await this.getClient();
        // Propagates the correlation ID into the legacy call itself
        // (CLAUDE.md section 9), not just this service's own logs.
        client.clearSoapHeaders();
        client.addSoapHeader({ CorrelationID: correlationId });

        const [raw] = (await client.CheckLegacyEmployeeAsync({ employeeId })) as [Record<string, unknown>];
        return normalizeResult(employeeId, raw);
      });
      // `wrap(...)`'s composed policy type erases the callback's
      // specific return type down to `unknown` — safe to assert back
      // since the callback above is the only thing it ever executes.
      return result as LegacyEmployeeRecord;
    } catch (err) {
      if (isTimeoutError(err)) {
        this.logger.error({ connector: "LegacyEmployeeClient", employeeId, correlationId }, "Legacy SOAP call timed out");
        throw new HttpError(504, "LEGACY_SYSTEM_TIMEOUT", "The legacy employee directory did not respond in time.");
      }
      if (isBrokenCircuitError(err)) {
        this.logger.error({ connector: "LegacyEmployeeClient", employeeId, correlationId }, "Legacy SOAP call rejected: circuit open");
        throw new HttpError(503, "LEGACY_SYSTEM_UNAVAILABLE", "The legacy employee directory is temporarily unavailable.");
      }
      const message = err instanceof Error ? err.message : "Unknown SOAP error.";
      this.logger.error({ connector: "LegacyEmployeeClient", employeeId, correlationId, error: message }, "Legacy SOAP call failed");
      throw new HttpError(502, "LEGACY_SYSTEM_ERROR", "The legacy employee directory returned an error.");
    }
  }
}

function normalizeResult(employeeId: string, result: Record<string, unknown>): LegacyEmployeeRecord {
  return {
    employeeId,
    exists: result.exists === true || result.exists === "true",
    fullName: typeof result.fullName === "string" ? result.fullName : null,
    department: typeof result.department === "string" ? result.department : null,
    status: (result.status as LegacyEmployeeRecord["status"]) ?? "NOT_FOUND",
  };
}

function describeRetryReason(reason: { error?: Error; value?: unknown }): string {
  return reason.error?.message ?? "Unknown error.";
}
