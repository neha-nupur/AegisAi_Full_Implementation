# AegisAI — Service Boundaries

Six logical services. Each owns its own data; no service may query
another service's tables/collections directly (see
`database-ownership.md`). Cross-service data needs go through that
service's published contract in `packages/shared-types`
(`ServiceContract` and its six per-service specializations) — never
through a shared repository or a raw database connection borrowed
from another service.

```
WRONG:   Gateway -> SELECT * FROM policies
CORRECT: Gateway -> PolicyServiceContract -> Policy Service -> Policy repository
```

Today every service runs in the same process (`apps/api` mounts each
service's router — a modular monolith, CLAUDE.md section 14). The
boundary is enforced by *code organization and the contract*, not by
a network hop: nothing in `apps/identity-service`, for example, may
import from `apps/policy-service/src/repositories`, and nothing
outside `apps/policy-service` may import from its `repositories/`
folder either. If a service is later split into its own process, its
router becomes an HTTP/RPC adapter over the same contract and callers
do not change.

Every service package follows the same internal layering:

```
routes/  ->  controllers/  ->  services/  ->  repositories/
```

`routes/` wires URLs to controllers and contains no logic.
`controllers/` are thin HTTP adapters (parse the request, call a
service, shape the response). `services/` hold the actual business
logic and are what implements the service's `ServiceContract`.
`repositories/` are the only code allowed to touch this service's own
tables/collections. `schemas/` holds this service's AJV validation
schemas, `middleware/` holds request-handling code specific to this
service (e.g. auth checks), and `types/` holds its local domain
types — all four are reserved as empty placeholders until the phase
that gives this service real business logic.

## Services

### 1. Identity & Access Management Service

- **Package:** `apps/identity-service` — health at `/v1/identity`;
  business API mounted directly at `/v1` (see `api-conventions.md`)
- **Responsibility:** organizations, users, authentication, JWT
  issuance/verification, authorization, RBAC, service accounts,
  session verification.
- **Owned entities:** `organizations`, `users`, `service_accounts`
  (PostgreSQL — see `database-ownership.md`).
- **Inputs (Phase 2):** login/credential requests (`POST
  /v1/auth/login`), bearer tokens on every protected request,
  organization/user/service-account management calls from operators.
- **Outputs (Phase 2):** issued JWTs, the authenticated caller's
  principal (attached to `req.principal` by `authenticateJWT`),
  organization/user/service-account records.
- **Dependencies:** none on other logical services. Since Phase 10,
  calls out to `soap-mock/` (a legacy system, not one of the six
  logical services) via `LegacyEmployeeClient` — see "The
  approval-resume knot" below for the general pattern this project
  uses for cross-service calls; a call to an external legacy system
  needs no such pattern since there's no risk of a circular package
  dependency.
- **Communication direction:** called directly by clients/operators
  today (login, admin screens). Will be called by Gateway (to
  authenticate inbound AI requests) starting Phase 3 — Identity never
  calls another *AegisAI* service (the Phase 10 SOAP connector calls
  outward to a legacy system, which is a different relationship
  entirely — see `database-ownership.md`'s Phase 10 note).
- **Phase 2 status:** real authentication and authorization,
  end-to-end through the full layering, backed by PostgreSQL. See
  `apps/identity-service/README.md` for the full endpoint table,
  RBAC model, and multi-tenancy rule. Implements the health portion
  of `IdentityServiceContract`; no domain methods are on that
  contract yet because nothing in-process calls Identity yet (Gateway
  will, starting Phase 3 — at that point `IdentityServiceContract`
  gains a token-verification method so Gateway depends on the
  contract, not on `identity-service`'s internals).
- **Phase 10 addition:** `GET /v1/legacy-employees/:employeeId`
  demonstrates a real SOAP integration (`LegacyEmployeeClient`) —
  WSDL parsing, timeout/retry/circuit breaker, correlation-ID
  propagation. This is a standalone demonstration endpoint, never
  called from the Gateway's request flow — SOAP is explicitly not a
  core dependency of normal AI request processing. See
  `apps/identity-service/README.md`'s Phase 10 section and
  `soap-mock/README.md`.

### 2. AI Request Gateway Service

- **Package:** `apps/gateway-service` — health at `/v1/gateway`;
  business API (`/ai-requests`) mounted directly at `/v1`, same
  convention as Identity (see `api-conventions.md`)
- **Responsibility:** public AI request entry point, request
  orchestration across the other five services, request lifecycle
  and state tracking, idempotency coordination, rate-limit
  coordination.
- **Owned entities:** `ai_requests`, request lifecycle metadata
  (PostgreSQL).
- **Inputs (Phase 3):** `POST /v1/ai-requests` — a bearer token
  (verified via Identity's `authenticateJWT`/`requirePermission`,
  reused in-process) plus `{ input, modelPreference?, policyId? }`,
  AJV-validated (`@aegisai/schemas`'s `createAiRequestSchema`).
- **Outputs (Phase 3):** the persisted `AIRequest` record, taken all
  the way to `COMPLETED` (with the mock provider's `output`,
  `modelId`, `providerId`) or `FAILED` (with `errorMessage`) before
  the HTTP response is sent — see "Phase 3 status" below for why this
  is synchronous rather than queued.
- **Dependencies (target architecture):** Identity (authn/authz —
  live now), Privacy (scan the request — Phase 4), Policy (evaluate
  and decide — Phase 4), Model & Provider (select and invoke — Phase
  5), Security/Audit (trace and event recording — Phase 8).
- **Communication direction:** the only service that calls all five
  other services; it is the orchestrator. Called by clients/AI
  agents directly.
- **Phase 3 status:** real, PostgreSQL-backed `ai_requests`, and the
  first true end-to-end vertical slice: JWT auth (Identity's
  middleware, reused) → AJV validation → `RECEIVED` → `VALIDATED` →
  `ROUTING` → `PROVIDER_CALL` → `COMPLETED`/`FAILED`. The mock
  provider call and provider-adapter interface live inside
  `gateway-service` itself for now (`src/providers/`) rather than in
  `apps/model-provider-service` — building out that service's real
  registry/routing is explicitly Phase 5 scope (`CLAUDE.md` section
  21); this interface is written so a Phase 5 `ModelRouter` can sit
  behind it without changing `AiRequestsService`'s shape. Likewise,
  "audit record" for this phase means structured Pino log events at
  every state transition (tagged with `traceId`/`aiRequestId`), not
  rows in `security-audit-service`'s owned MongoDB collections — that
  service's real domain logic and persistence is Phase 8 scope. See
  `apps/gateway-service/README.md` for the endpoint table and the
  synchronous-vs-queued design decision.
- **Phase 4 update:** the flow between `VALIDATED` and `ROUTING` now
  runs Privacy Scan then Policy Evaluation (both in-process, both
  services' packages), branching to `BLOCKED` (policy `BLOCK`) or
  `APPROVAL_REQUIRED` (policy `REQUIRE_APPROVAL`, paused until a
  human decides — see section 4's "approval-resume knot") instead of
  proceeding to the provider. See `apps/gateway-service/README.md`
  for the full updated state diagram.

### 3. Privacy Scanner Service

- **Package:** `apps/privacy-service` — health at `/v1/privacy`; no
  public business API of its own — called in-process by Gateway (see
  "Phase 4 status" below)
- **Responsibility:** PII detection, sensitive-data classification,
  secret detection, configurable detection patterns, producing
  structured findings, masking/redaction decisions.
- **Owned entities:** `scanner_results`, scanner findings (MongoDB).
- **Inputs (Phase 4):** the raw `input` text of an `AIRequest`, from
  `AiRequestsService` (Gateway).
- **Outputs (Phase 4):** a `ScanResult` — `{ detected, findings:
  [{ type, location, confidence, action }] }` — plus, separately, a
  `redact()` method that returns a masked copy of the text. Never the
  matched substring itself, anywhere.
- **Dependencies:** none on other logical services.
- **Communication direction:** called by Gateway only, in-process
  (`PrivacyScanService`, exported from this package); does not call
  any other service.
- **Phase 4 status:** real. Deterministic regex-based detectors for
  email, phone, PAN-like, Aadhaar-like, API-key/secret, and
  password/credential patterns, plus a configurable sensitive-keyword
  list (`SENSITIVE_KEYWORDS` env var, this service's own concern —
  not added to `@aegisai/config`'s shared required-env contract).
  `scanner_results` in MongoDB stores only `type`/`location`/
  `confidence`/`action` per finding — never the raw matched text, at
  the source (the scan result itself never contains it), not only at
  the persistence layer. See `apps/privacy-service/README.md`.

### 4. Policy & Approval Service

- **Package:** `apps/policy-service` — health at `/v1/policy`;
  business API (`/policies`, `/approvals`) mounted directly at `/v1`
- **Responsibility:** policy CRUD, policy evaluation, governance
  decisions (`ALLOW` / `BLOCK` / `MASK` / `REQUIRE_APPROVAL` /
  `ROUTE`), human approval workflow.
- **Owned entities:** `policies`, `approvals` (PostgreSQL).
- **Inputs (Phase 4):** an evaluation context (organization, resolved
  `policyId`, requester role, detected finding types, requested
  model) from `AiRequestsService` (Gateway); approval decisions
  (`POST /v1/approvals/:id/approve|reject`) from an authorized
  organization user.
- **Outputs (Phase 4):** a `PolicyDecision` — one of the five actions
  above, with the matched rule and a human-readable reason; policy
  and approval records via REST.
- **Dependencies:** none on other logical services at evaluation
  time — it evaluates against data the Gateway supplies. See "the
  approval-resume knot" below for how it notifies the Gateway once a
  human decides an approval, without depending on that package.
- **Communication direction:** called by Gateway (in-process,
  `PolicyEvaluationService`) to evaluate, and by the frontend (REST)
  for approval workflow and policy management. Does not call any
  other service's package directly.
- **Phase 4 status:** real. A first-match-wins rule engine
  (`evaluatePolicy`) that **fails closed to `BLOCK`** if a custom
  policy's rules don't cover a request — a governance gateway should
  never silently let an ungoverned request through. A built-in
  default policy (`buildDefaultPolicy`, never persisted) is used
  until an organization creates its own, so `"policy_default"` (the
  id used in the Phase 3 example payload) works out of the box:
  secrets → `BLOCK`, sensitive keywords → `REQUIRE_APPROVAL`, PII →
  `MASK`, else → `ALLOW`. `ROUTE` is a valid rule action but has no
  real behavior yet beyond falling through to a provider call
  identically to `ALLOW` — real model routing is Phase 5 scope.

**The approval-resume knot.** `AiRequestsService` (Gateway) needs to
create an `Approval` row when Policy decides `REQUIRE_APPROVAL`, and
`ApprovalsService` (Policy) needs to resume the paused `AIRequest`
once a human decides it — a genuine two-way runtime dependency. Making
either package import the other's concrete class would create a
circular workspace dependency (Gateway already depends on Policy to
evaluate). Instead, each service defines the interface *it* needs
(`ApprovalCreator` in gateway-service, `ApprovalResumeHandler` in
policy-service) and depends only on that — `apps/api`, the
composition root, is the one place allowed to know about both
concrete classes: it constructs `AiRequestsService` and
`ApprovalsService`, wires the resume handler in via the constructor,
and calls `aiRequestsService.setApprovalCreator(approvalsService)`
(TypeScript's structural typing means `ApprovalsService` satisfies
`ApprovalCreator` without policy-service importing gateway-service's
type at all). See `apps/api/src/app.ts`.

### 5. Model & Provider Management Service

- **Package:** `apps/model-provider-service` — mounted at
  `/v1/model-provider`
- **Responsibility:** AI provider registry, model registry, provider
  health tracking, model capability metadata, model selection,
  routing, provider adapters, provider invocation (behind timeout /
  retry / circuit breaker, from Phase 7).
- **Owned entities:** `providers`, `models`, routing metadata
  (PostgreSQL).
- **Inputs (from Phase 5):** a model-selection request (capability
  needs, sensitivity, org budget/availability) and, ultimately, the
  prompt to send to the selected provider.
- **Outputs (from Phase 5):** the selected model/provider, and
  (once invocation is implemented) the raw provider response for the
  Gateway to filter.
- **Dependencies:** none on other logical services; calls out to
  external AI provider APIs (Phase 5+) through provider-specific
  adapters that never leak provider SDK details outside this
  service (CLAUDE.md section 12).
- **Communication direction:** called by Gateway only.
- **Phase 1 status:** `GET /health` only. Implements the health
  portion of `ModelProviderServiceContract`. Registry/routing logic
  starts Phase 5.

### 6. Security, Audit & Observability Service

- **Package:** `apps/security-audit-service` — mounted at
  `/v1/security-audit`
- **Responsibility:** request traces, security events, audit events,
  correlation-ID-based request lifecycle reconstruction, audit
  querying.
- **Owned entities:** `request_traces`, `security_events`,
  `audit_events` (MongoDB).
- **Inputs (from Phase 8):** trace/event records emitted by every
  other service as a request moves through the system, each carrying
  the request's correlation ID.
- **Outputs (from Phase 8):** persisted traces/events, and query
  results for the frontend's Trace/Replay, Security Events, and
  Audit Log screens.
- **Dependencies:** none on other logical services for writes; every
  other service depends on it to record what happened.
- **Communication direction:** called by every other service
  (write path) and by the frontend (read/query path). Does not call
  any other service.
- **Phase 1 status:** `GET /health` only. Implements the health
  portion of `SecurityAuditServiceContract`. Trace/event recording
  starts Phase 8.

## Status summary

All six services have a real, independently reachable `GET /health`
(`/v1/<service>/health`), implemented through the full
`routes -> controllers -> services -> repositories` layering, and
implement the health portion of their `ServiceContract` from
`@aegisai/shared-types`.

**Identity (Phase 2)** additionally has real authentication,
authorization, and PostgreSQL-backed persistence — the first service
whose `repositories/`, `schemas/` (partially — see its README),
`middleware/`, and `types/` folders hold real code instead of a
placeholder. The other five services are still Phase 1: those four
folders remain reserved placeholders, business logic starts with
their own owning phase (see each service's entry above). `apps/api`
remains the physical host process, importing and mounting each
service's router(s); it will keep doing so as more business routes
are added, per CLAUDE.md section 14 (logical boundaries now, physical
splitting later if ever needed).
