# AegisAI — Architecture

AegisAI is an enterprise AI security and governance control plane. It
sits between enterprise applications / AI agents and AI model
providers, and enforces authentication, authorization, request
validation, idempotency, rate limiting, privacy scanning, policy
evaluation, model routing, reliability protection, and audit/trace
recording on every AI request.

## Canonical request flow

```
Client / AI Agent
      |
JWT Authentication
      |
Authorization / RBAC
      |
AJV Request Validation
      |
Idempotency Check
      |
Rate Limit Check
      |
Privacy Scanner
      |
Policy Evaluation
      |
ALLOW / BLOCK / MASK / REQUIRE_APPROVAL / ROUTE
      |
Model & Provider Selection
      |
Provider Invocation
      |
Timeout / Retry / Circuit Breaker
      |
Response Filtering
      |
Security Event
      |
Request Trace
      |
Audit Event
      |
Client Response
```

Every implementation phase preserves this conceptual flow, even before
every step is fully implemented.

## Deployment shape

AegisAI starts as a **modular monolith**: six logical services with
strict data ownership and no cross-service repository access, hosted
initially inside a single running process (`apps/api`). The boundaries
are kept clean enough that any service can be extracted into its own
deployable later without changing its contract.

## Service internals

Every service package (`apps/identity-service`, `apps/gateway-service`,
`apps/privacy-service`, `apps/policy-service`,
`apps/model-provider-service`, `apps/security-audit-service`) follows
the same internal layering, so business logic never lives in a route
handler:

```
routes/  ->  controllers/  ->  services/  ->  repositories/
```

Each service publishes its public contract as a TypeScript interface
in `packages/shared-types` (e.g. `IdentityServiceContract`) — the only
sanctioned description of what it does for any caller, including
`apps/api` and, eventually, other services. `apps/api` mounts each
service's router under its own `/v1/<service>` path (see
`docs/service-boundaries.md`); every service answers its own
`GET /v1/<service>/health` end-to-end through that layering.
`repositories/`, `schemas/`, `middleware/`, and `types/` are reserved
per service until the phase that gives it real domain logic — Identity
(Phase 2) is the first to have real code in all four: PostgreSQL
repositories, JWT authorization middleware, and its own domain types,
mounted as a *second* router (`identityApiRouter`, at `/v1` directly)
alongside the health-only one. See `apps/identity-service/README.md`
for the resulting endpoint table.

## Technology stack

- **Backend:** Node.js, TypeScript (strict), Express, AJV, PostgreSQL,
  MongoDB, Redis, JWT, Pino, Jest, Supertest, GraphQL, SOAP/WSDL, Docker
- **Frontend:** React, Vite, TypeScript
- **Background processing:** Worker process, BullMQ where justified

See `/CLAUDE.md` for the full architectural contract and phase plan.
