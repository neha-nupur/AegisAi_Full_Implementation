# AegisAI — Architectural Contract

This file is the permanent architectural contract for AegisAI. It
must be read completely before any phase begins, and followed for
every phase after.

## 1. Project purpose

AegisAI is an enterprise AI security and governance control plane. It
sits between enterprise applications / AI agents and AI model
providers, and must:

- authenticate AI callers
- authorize users and service accounts
- validate AI requests
- enforce idempotency
- enforce rate limits
- detect PII and sensitive information
- detect secrets
- evaluate organizational AI policies
- mask/block/allow/route requests
- require human approval when necessary
- select an appropriate AI model/provider
- protect outbound AI calls using timeout, retry and circuit breaker
- filter controlled responses
- maintain request traces
- record security events
- maintain audit logs
- integrate with legacy SOAP/WSDL systems
- expose REST and GraphQL interfaces
- provide an enterprise monitoring dashboard

The system must look and behave like a serious enterprise
infrastructure/security product, not a generic AI chatbot.

## 2. Authoritative architecture

Six logical services. Mandatory.

1. **Identity & Access Management Service** — organizations, users,
   authentication, JWT, authorization, RBAC, service accounts, session
   verification. Owns: `organizations`, `users`, `service_accounts`.
2. **AI Request Gateway Service** — public AI request entry point,
   orchestration, request lifecycle/state, idempotency coordination,
   rate-limit coordination, communication with other services. Owns:
   `ai_requests`, request lifecycle metadata.
3. **Privacy Scanner Service** — PII detection, sensitive data
   detection, secret detection, configurable patterns, findings,
   masking/redaction. Owns: `scanner_results`, scanner findings.
4. **Policy & Approval Service** — policy management, policy
   evaluation, governance decisions, approval workflow. Supported
   policy actions: `ALLOW`, `BLOCK`, `MASK`, `REQUIRE_APPROVAL`,
   `ROUTE`. Owns: `policies`, `approvals`.
5. **Model & Provider Management Service** — AI provider registry,
   model registry, provider health, model capabilities, model
   selection, routing, provider adapters, provider invocation. Owns:
   `providers`, `models`, routing metadata.
6. **Security, Audit & Observability Service** — request traces, audit
   events, security events, correlation IDs, request lifecycle
   reconstruction, audit querying, provider/security observability.
   Owns: `request_traces`, `security_events`, `audit_events`.

## 3. Service ownership rule (critical)

A service owns its own data. Another service MUST NOT directly query
another service's database tables.

```
WRONG:   Gateway -> SELECT * FROM policies
CORRECT: Gateway -> Policy Service contract -> Policy Service -> Policy repository
```

The first implementation may be a modular monolith for simplicity.
However, the logical service boundaries must remain clear so that the
services can later be separated into processes/containers. Do not
introduce unnecessary microservice infrastructure merely for
appearance.

## 4. Main request flow

```
Client / AI Agent
  -> JWT Authentication
  -> Authorization / RBAC
  -> AJV Request Validation
  -> Idempotency Check
  -> Rate Limit Check
  -> Privacy Scanner
  -> Policy Evaluation
  -> ALLOW / BLOCK / MASK / REQUIRE_APPROVAL / ROUTE
  -> Model & Provider Selection
  -> Provider Invocation
  -> Timeout / Retry / Circuit Breaker
  -> Response Filtering
  -> Security Event
  -> Request Trace
  -> Audit Event
  -> Client Response
```

Every implementation phase must preserve this conceptual flow.

## 5. Technology stack

**Backend:** Node.js, TypeScript, Express.js, AJV, PostgreSQL,
MongoDB, Redis, JWT, Pino, Jest, Supertest, GraphQL, SOAP/WSDL, Docker.

**Frontend:** React, Vite, TypeScript.

**Infrastructure:** Docker Compose, Redis, PostgreSQL, MongoDB.

**Background processing:** Worker, BullMQ where justified.

Do NOT introduce additional frameworks unless there is a strong
technical reason. If a dependency seems necessary, explain why before
introducing it.

## 6. Database responsibilities

**PostgreSQL** — structured relational/business data: organizations,
users, service_accounts, policies, approvals, providers, models,
ai_requests.

**MongoDB** — document/event-oriented data: request traces, audit
events, security events, scanner results, provider interaction
metadata.

**Redis** — rate limiting, idempotency, caching, temporary state,
distributed coordination where needed. Never the primary source of
business truth.

## 7. REST API rules

All public REST APIs under `/v1/...`. Resource-shaped URLs, correct
HTTP methods. No verb-based URLs (`/getAIRequest`, `/createPolicy`,
`/deleteUser`, etc.).

## 8. Error contract

One consistent shape everywhere:

```json
{
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "traceId": "..."
  }
}
```

Do not create different error shapes in different services.

## 9. Observability rule

Every request has a correlation ID, propagating through Gateway ->
Privacy -> Policy -> Model/Provider -> Security/Audit. Structured
logging via Pino. Never log passwords, JWT secrets, provider API keys,
raw credentials, unnecessary sensitive PII, or full secret-containing
prompts.

## 10. Security rules

Never hardcode secrets (use environment variables). Hash passwords.
Use JWT expiration and RBAC. Use parameterized SQL. Configure CORS
explicitly. Validate external input with AJV. Treat provider responses
as untrusted external data. Redact sensitive information before
persistence where necessary.

## 11. AI security rule

The Privacy Scanner starts with deterministic, explainable patterns
(email, phone, PAN-like, Aadhaar-like, API keys, passwords,
credentials, configurable sensitive keywords) — not a complex ML model
in the first implementation. The scanner produces structured findings.

## 12. Model routing rule

Model selection should eventually weigh capability, sensitivity,
policy, provider health, cost, organization budget, and availability.
Provider-specific code stays inside provider adapters; the gateway
must not contain provider SDK-specific logic.

## 13. Resilience rule

Every outbound dependency call eventually has: explicit timeout, retry
when appropriate, increasing/exponential backoff, maximum retry count,
and a circuit breaker (`CLOSED` / `OPEN` / `HALF-OPEN`). Do not retry
permanent errors.

## 14. Six services vs. physical deployment

Do NOT assume six logical services means six independently deployed
servers immediately. A modular monolith is acceptable early on. What
matters: clear service boundaries, clear interfaces, clear data
ownership, no cross-service repository access. Physical splitting can
happen later.

## 15. Professor's 28 requirements

See `/docs/checklist-mapping.md` for the live tracking table. A
requirement is complete only when implementation exists, a test exists
where appropriate, documentation exists, it can be demonstrated, and
evidence can be captured — never simply because code exists.

## 16. Development methodology

Phase by phase. Never implement future phases unless explicitly
instructed. Before modifying code: inspect the repository, understand
existing architecture, read relevant docs, identify existing
implementations, check current tests, plan the change, implement only
the requested phase, run tests, run typecheck/build, fix issues
introduced by this phase, update documentation, report what changed.
Do not rewrite working functionality unnecessarily, silently change
APIs or database ownership, or introduce duplicate implementations.

## 17. Code quality

Use TypeScript strict mode, clear naming, small focused functions,
dependency injection where useful, controller/service/repository
separation, reusable middleware, centralized configuration and error
handling, typed request/response contracts, validation schemas, and
meaningful tests. Avoid giant files/controllers, business logic in
routes or React components, direct DB calls from controllers,
duplicated validation, hardcoded configuration, and magic strings
where enums/constants fit better.

## 18. Frontend principles

An enterprise AI security control plane, not a chatbot clone. Screens:
Login, Overview, AI Request Explorer, AI Request Detail, Trace/Replay,
Policies, Approvals, Models & Providers, Security Events, Audit Logs,
Settings. Dark, professional, security/infrastructure-oriented, with
clear status indicators, dashboards, tables, timelines, and charts
where useful; responsive layout.

## 19. Testing rule

Every phase adds appropriate tests — not postponed to the end. At
minimum: unit tests for business logic, integration tests for API
boundaries, Supertest for HTTP behavior.

## 20. Documentation rule

Maintain `docs/architecture.md`, `docs/service-boundaries.md`,
`docs/database-ownership.md`, `docs/api-conventions.md`,
`docs/checklist-mapping.md`, `docs/phase-progress.md`. Update these
whenever architecture changes.

## 21. Phase control

- Phase 0 — Foundation and project structure
- Phase 1 — Six service boundaries
- Phase 2 — Identity, authentication and authorization
- Phase 3 — AI Gateway + first vertical slice
- Phase 4 — Privacy Scanner + Policy + Approval
- Phase 5 — Model & Provider Management + real AI provider
- Phase 6 — Redis + HTTP/Web Service requirements
- Phase 7 — Timeout + Retry + Circuit Breaker + fallback
- Phase 8 — Security + Audit + Observability
- Phase 9 — Frontend + GraphQL
- Phase 10 — SOAP/WSDL + XML interoperability
- Phase 11 — Testing + Docker + deployment + final 28-item verification

Do not skip phases. Do not automatically start the next phase.

## 22. Phase completion rule

At the end of every phase, provide: summary; files created; files
modified; APIs added/changed; database changes; dependencies added;
tests added; tests executed; build/type-check results; manual
verification instructions; requirements completed; requirements still
pending; known limitations; architecture decisions made; what the next
phase will depend on. Then stop.

## 23. Claude/agent behavior

Do not guess when project context is missing. If something is
ambiguous: inspect the repository, inspect documentation, inspect
existing types/contracts, then make the smallest reasonable decision.
If a decision would materially change architecture, stop and ask
before implementing it. Do not create a huge speculative
implementation, and do not implement features merely because they may
be useful later. Implement exactly what the current phase requires.
Prioritize correctness and maintainability over speed.
