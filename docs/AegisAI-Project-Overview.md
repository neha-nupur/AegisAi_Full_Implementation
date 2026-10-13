# AegisAI — Complete Project Overview

*This document reflects the actual, current state of the AegisAI codebase based on live repository inspection.*

## 1. PROJECT EXECUTIVE SUMMARY

**Project Name:** AegisAI

**Purpose:** An enterprise AI security and governance control plane.

**Problem it solves:** Direct integration with AI providers (like OpenAI or Gemini) exposes enterprises to data leaks (PII/secrets), runaway costs, uncontrolled model selection, and lack of auditability. AegisAI sits between internal applications/agents and external AI providers to govern, secure, and monitor all AI traffic.

**Target Users:** Organization Administrators, Developers, and Security Auditors.

**Why an AI Security Gateway is needed:** It provides a central choke point for authentication, rate limiting, deterministic privacy scanning, policy enforcement (blocking/masking), and robust audit logging, ensuring enterprise compliance before data ever reaches a third-party AI provider.

**Architecture Flow:**
```
Client / AI Agent
        ↓
AegisAI Gateway
        ↓
Authentication
        ↓
Validation
        ↓
Privacy
        ↓
Policy
        ↓
Model Routing
        ↓
AI Provider
        ↓
Response
        ↓
Audit / Trace / Security
```

## 2. CURRENT PROJECT STATUS

**Status:** **Fully Working (Modular Monolith)**

The core project is functionally implemented and verified live. It is currently deployed as a modular monolith (all logical services hosted within `apps/api`), backed by actual PostgreSQL, MongoDB, and Redis instances.

- **IMPLEMENTED:** All six logical services, DB schemas, REST APIs, GraphQL, RBAC, frontend dashboards, privacy scanning, policy engine, legacy SOAP connector, settings management.
- **TESTED:** 146+ automated Jest/Supertest tests passing project-wide, covering unit, integration, and resilience scenarios.
- **LIVE VERIFIED:** Frontend dashboards correctly fetch from the backend, actual PII is redacted, real SOAP calls succeed, JWT tokens authenticate appropriately, and organization settings are fully persisted. 

*Note on Worker:* The worker service exists in Docker but remains a placeholder (exits after startup).

## 3. COMPLETE PHASE HISTORY

### Phase 0 — Foundation and project structure
Purpose: Initial monorepo setup with shared types, config, and scaffolding.
Current status: ✅ Implemented

### Phase 1 — Six service boundaries
Purpose: Establish the structural boundaries for Identity, Gateway, Privacy, Policy, Provider, and Security.
Current status: ✅ Implemented

### Phase 2 — Identity, authentication and authorization
Purpose: Implement PostgreSQL schema for orgs/users/service accounts, bcrypt, JWT auth, and RBAC (`ORGANIZATION_ADMIN`, `DEVELOPER`, `SECURITY_AUDITOR`).
Current status: ✅ Implemented & Tested

### Phase 3 — AI Gateway + first vertical slice
Purpose: AJV validation, idempotency, rate limiting, and the central AI request orchestration loop.
Current status: ✅ Implemented & Tested

### Phase 4 — Privacy Scanner + Policy + Approval
Purpose: Deterministic regex/keyword scanning, MongoDB `scanner_results` persistence, and the policy engine (ALLOW, BLOCK, MASK, REQUIRE_APPROVAL).
Current status: ✅ Implemented & Tested

### Phase 5 — Model & Provider Management
Purpose: Provider registry, routing logic, and real AI provider integrations (Gemini, OpenAI, Mock).
Current status: ✅ Implemented & Tested

### Phase 6 — Redis + HTTP/Web Service requirements
Purpose: Add Redis for rate limiting and idempotency. Enforce ETag, Cache-Control, Pagination.
Current status: ✅ Implemented & Tested

### Phase 7 — Timeout + Retry + Circuit Breaker
Purpose: Implement `cockatiel` resilience (circuit breaker, exponential backoff, timeout) for outgoing provider calls.
Current status: ✅ Implemented & Tested

### Phase 8 — Security + Audit + Observability
Purpose: Trace logging, correlation ID tracking, and audit/security event persistence to MongoDB.
Current status: ✅ Implemented & Tested

### Phase 9 — Frontend + GraphQL
Purpose: React SPA dashboard with Apollo Server GraphQL integration alongside REST.
Current status: ✅ Implemented & Tested

### Phase 10 — SOAP/WSDL + XML interoperability
Purpose: Legacy enterprise HR integration using a SOAP mock server and `cockatiel` resilience, plus global XML content negotiation.
Current status: ✅ Implemented & Tested

### Phase 11 — Testing + Docker + Deployment prep
Purpose: Finalize Docker Compose, testing regression fixes, and deployment documentation.
Current status: ⚠️ Partially verified (Docker environment verified via local processes, but actual containerized deployment isn't internet-facing yet).

### Final Functional Completion (Latest Phase)
Purpose: Ensure Privacy Scanner Sandbox, Legacy Integration (SOAP), and Settings pages were functionally complete end-to-end on the frontend, hitting real backend services.
Current status: ✅ Implemented & Live Verified

## 4. CURRENT FINAL PHASE

The latest completed phase focused on ensuring all frontend control-plane screens (Privacy Sandbox, Legacy Integration, and Organization Settings) are genuinely functional.

- **Added:** A real `POST /v1/privacy/scan` sandbox API; `GET /v1/legacy-employees/:id` wiring in the frontend; `organization_settings` PostgreSQL schema, Repository, Service, and Controller for operational configuration.
- **Fixed:** Frontend UI mapping to actual backend responses, handling of missing fields, and specific DB permissions.
- **Tested:** RBAC for settings (`settings:write` for admins, `settings:read` for others). 
- **Remains:** Final production deployment, HTTPS, and replacing the `worker` placeholder with actual BullMQ background jobs.

## 5. SIX AEGISAI SERVICES

AegisAI currently uses a **modular monolith architecture** with distinct logical service boundaries.

1. **Identity & Access Management**
   - *Responsibility:* Org/User management, JWT issuance, RBAC.
   - *Data:* PostgreSQL (`organizations`, `users`, `service_accounts`, `organization_settings`).
   - *Important:* `authenticateJWT`, `requirePermission`, `SettingsService`.

2. **AI Request Gateway**
   - *Responsibility:* Public API ingress, rate limiting, idempotency, orchestration.
   - *Data:* PostgreSQL (`ai_requests`), Redis (Rate limits, idempotency).
   - *Important:* `AiRequestsService`, `rateLimitMiddleware`.

3. **Privacy Scanner**
   - *Responsibility:* Regex-based PII and secret detection, redaction.
   - *Data:* MongoDB (`scanner_results`).
   - *Important:* `PrivacyScanner`, `MongoScannerResultsRepository`.

4. **Policy & Approval**
   - *Responsibility:* First-match policy rule engine, manual human approvals.
   - *Data:* PostgreSQL (`policies`, `approvals`).
   - *Important:* `evaluatePolicy`, `ApprovalsService`.

5. **Model & Provider Management**
   - *Responsibility:* Routing to external AI APIs safely.
   - *Data:* PostgreSQL (`providers`, `models`).
   - *Important:* `ResilientProviderAdapter`, `gemini.provider.ts`.

6. **Security, Audit & Observability**
   - *Responsibility:* Immutable audit logs, traces, and security incidents.
   - *Data:* MongoDB (`audit_events`, `security_events`, `request_traces`).
   - *Important:* `correlationIdMiddleware`, `AuditService`.

## 6. COMPLETE REQUEST FLOW

```mermaid
graph TD
    Client[Client] --> Auth[JWT Authentication]
    Auth --> RBAC[Authorization / RBAC]
    RBAC --> Validate[AJV Request Validation]
    Validate --> Idempotency[Idempotency Check]
    Idempotency --> RateLimiting[Rate Limiting]
    RateLimiting --> Privacy[Privacy Scan]
    Privacy --> Policy[Policy Evaluation]
    Policy --> Decision{Action?}
    Decision -->|BLOCK| AuditBlock[Audit & Reject]
    Decision -->|REQUIRE_APPROVAL| Approval[Pause for Human Approval]
    Decision -->|MASK| MaskData[Redact Input]
    MaskData --> Route[Model Routing]
    Decision -->|ALLOW| Route
    Approval -->|Approved| Route
    Route --> Resilience[Timeout/Retry/Circuit Breaker]
    Resilience --> Provider[AI Provider API]
    Provider --> Audit[Audit & Trace]
    AuditBlock --> Client
    Audit --> Client
```

- **Authentication:** Verifies JWT token and issues 401 if invalid.
- **Privacy Scan:** Identifies PII using regex. Handled by `PrivacyScanner`.
- **Policy:** Rules run against findings. Handled by `PolicyService`.
- **Model Routing:** Picks adapter. Handled by `ModelProviderService`.
- **Resilience:** `cockatiel` enforces timeouts (30s) and retries.
- **Failure:** Errors yield a consistent JSON API error envelope and are logged via Pino.

## 7. AUTHENTICATION & AUTHORIZATION

- **Authentication:** `POST /v1/auth/login` checks credentials using `bcrypt` and issues a short-lived JWT.
- **Authorization (RBAC):** Middleware (`authenticateJWT` and `requirePermission`) enforce access controls at the route level.
- **Roles Defined in Code:** `ORGANIZATION_ADMIN`, `DEVELOPER`, `SECURITY_AUDITOR`.
- **Org Isolation:** JWT tokens encode the `organizationId`. Queries include `WHERE organization_id = $1` to guarantee tenant isolation. Cross-tenant access yields 404s, not 403s.
- **Failures:** Missing/invalid token = `401`. Insufficient permissions = `403`.

## 8. PRIVACY & SECURITY

- **Detection:** Deterministic regex for Emails, Phone Numbers, PAN, Aadhaar, API Keys, and Passwords.
- **Action:** Findings suggest an action (e.g., API Keys = BLOCK, Email = MASK).
- **Masking:** Detected strings are replaced in the raw prompt before sending to the external provider.
- **Sandbox:** A `/v1/privacy/scan` endpoint allows users to test the scanner safely without storing the prompt in the database.

## 9. POLICY & APPROVAL SYSTEM

- **Evaluation:** First-match rule engine. If no rules match, the default is to `BLOCK`.
- **Actions:** `ALLOW`, `BLOCK`, `MASK`, `REQUIRE_APPROVAL`, `ROUTE`.
- **Approvals:** Puts the request into an `APPROVAL_REQUIRED` state. A user with `approvals:write` (Org Admin) can approve or reject. Once approved, the gateway resumes processing via the `ApprovalResumeHandler`.

## 10. MODEL & PROVIDER MANAGEMENT

- **Abstraction:** Providers implement `ProviderAdapter`.
- **Routing:** Selects adapter based on request preferences or default fallbacks.
- **Implemented Providers:** `MockProviderAdapter`, `OpenAiProviderAdapter`, `GeminiProviderAdapter`.
- **Gemini Status:** Configured server-side. Connects using the API key loaded from `GEMINI_API_KEY` in `.env`.

## 11. RESILIENCE

- **Library:** `cockatiel`
- **Circuit Breaker:** Trips (`OPEN`) after 5 consecutive failures, failing fast (503). Transitions to `HALF-OPEN` after 30 seconds.
- **Retry:** Up to 3 retries with jittered exponential backoff (500ms to 5000ms) for transient errors (429, 500, 502). Permanent errors (400, 403) fail immediately.
- **Timeout:** 30s strict timeout for AI providers, 5s for SOAP integrations.

## 12. DATABASE ARCHITECTURE

| Data | Database | Owner | Purpose |
|---|---|---|---|
| Users/Orgs/Settings | PostgreSQL | Identity | Highly structured relational tenant data. |
| AI Requests | PostgreSQL | Gateway | Core relational transaction state. |
| Scanner Results | MongoDB | Privacy | Document-based varied finding outputs. |
| Policies/Approvals | PostgreSQL | Policy | Strict relational rule structures. |
| Providers/Models | PostgreSQL | Model Provider | Strict relational registries. |
| Audit/Security Events | MongoDB | Security/Audit | High volume, schemaless event streams. |
| Traces | MongoDB | Security/Audit | Deeply nested timeline data. |
| Rate Limits | Redis | Gateway | High-throughput ephemeral counters. |

## 13. FRONTEND

All of the following pages are implemented and functional in the React SPA:

- **DashboardPage:** Overview metrics.
- **AiRequestsPage:** AI request history.
- **NewAiRequestPage:** Submitting a prompt.
- **AiRequestDetailPage:** Single request trace.
- **PrivacyScannerPage:** Sandbox to test redaction capabilities.
- **PoliciesPage:** Rule management.
- **ApprovalsPage:** Review pending human approvals.
- **ModelsProvidersPage:** List of supported AI endpoints.
- **IdentityPage:** Users and Service Accounts management.
- **SecurityAuditPage:** Audit log and security event history.
- **TracesPage:** Request lifecycle tracing.
- **LegacyPage:** SOAP WSDL legacy bridging test.
- **SettingsPage:** Operational defaults and toggles (Timeout, Auto-Masking, etc.).

## 14. GRAPHQL

- **Endpoint:** `POST /v1/graphql`
- **Usage:** Serves the AI requests list in the frontend dashboard.
- **Why it exists:** Alongside the standard REST APIs, GraphQL was implemented to satisfy API requirements for querying nested data selectively (e.g., fetching a request alongside its specific policy evaluations) and demonstrating Apollo Server compatibility.

## 15. REST API

**Core Endpoints:**
- `POST /v1/auth/login` (Public)
- `GET/POST /v1/ai-requests` (Auth, `ai_requests:read/write`)
- `POST /v1/privacy/scan` (Auth, Sandbox)
- `GET/POST /v1/policies` (Auth, `policies:read/write`)
- `POST /v1/approvals/:id/approve` (Auth, `approvals:write`)
- `GET /v1/settings` (Auth, `settings:read`)
- `PATCH /v1/settings` (Auth, `settings:write`)
- `GET /v1/legacy-employees/:id` (Auth)

## 16. SOAP / LEGACY INTEGRATION

- **WSDL:** Provided by the `soap-mock` container.
- **Integration:** The Identity service has a `LegacyEmployeeClient` that parses the WSDL, connects via `soap`, and performs `CheckLegacyEmployee`.
- **Status:** Verified live. The `cockatiel` circuit breaker and timeout (5s) apply to this call.

## 17. OBSERVABILITY

- **Structured Logging:** Uses `pino`.
- **Correlation ID:** Every request generates a UUID upon ingress (via middleware). This ID is injected into every log line and tied to Mongo `request_traces`.
- **Reconstruction:** A single AI request can be perfectly reconstructed by querying the Mongo trace and audit events by its `traceId`.

## 18. API STANDARDS / PROFESSOR REQUIREMENTS

| # | Requirement | Implementation | Status |
|---|---|---|---|
| 1 | Correct HTTP method | REST guidelines followed everywhere | ✅ Implemented & Verified |
| 2 | Idempotency POST | `Idempotency-Key` + Redis caching | ✅ Implemented & Verified |
| 3 | JSON Schema AJV | Standardized schema validation | ✅ Implemented & Verified |
| 4 | Versioning `/v1` | All endpoints prefixed | ✅ Implemented & Verified |
| 5 | 8+ Status Codes | Returns 200, 201, 204, 304, 400, 401, 403, 404, 409, 422, 429, 500, 502, 503, 504 | ✅ Implemented & Verified |
| 6 | ETag / 304 | Supported on GET endpoints | ✅ Implemented & Verified |
| 7 | JSON/XML Content | Global negotiation middleware | ✅ Implemented & Verified |
| 8 | Cursor Pagination | Next cursor included in meta payload | ✅ Implemented & Verified |
| 9 | Consistent Error Body | Single standardized schema | ✅ Implemented & Verified |
| 10 | Cache-Control | Set accurately per HTTP method | ✅ Implemented & Verified |
| 11 | Resource URLs | e.g. `/v1/users`, no verbs | ✅ Implemented & Verified |
| 12 | Rate limits / 429 | Redis sliding window | ✅ Implemented & Verified |
| 13 | OpenAPI Doc | Hand-written YAML available | ✅ Implemented & Verified |
| 14 | GraphQL | Apollo Server + Frontend consumption | ✅ Implemented & Verified |
| 15 | Circuit breaker | `cockatiel` library | ✅ Implemented & Verified |
| 16 | SQL/Param queries | PostgreSQL `pg` driver used | ✅ Implemented & Verified |
| 17 | CORS config | Specific origins bound via env var | ✅ Implemented & Verified |
| 18 | Deployed live | N/A (Local testing only) | ❌ Missing |
| 19 | Swagger UI | Exposed natively via `/docs` | ✅ Implemented & Verified |
| 20 | Outbound timeouts | 30s APIs, 5s SOAP | ✅ Implemented & Verified |
| 21 | Express MW | Error, logging, auth middleware | ✅ Implemented & Verified |
| 22 | NoSQL Store | MongoDB for traces/audit | ✅ Implemented & Verified |
| 23 | Jest/Supertest | 146 tests passing | ✅ Implemented & Verified |
| 24 | SOAP/WSDL | Native node-soap client | ✅ Implemented & Verified |
| 25 | Exponential Backoff | Integrated with `cockatiel` retries | ✅ Implemented & Verified |
| 26 | Structured logging | Pino + Trace IDs | ✅ Implemented & Verified |
| 27 | JWT + AuthZ | RBAC + signed tokens | ✅ Implemented & Verified |
| 28 | Docker/12-factor | Full compose stack | 🟡 Implemented but Not Fully Verified (Local processes run fine, but full containerized deployment not tested on public internet) |

## 19. TESTING

- **Frameworks:** Jest, Supertest.
- **Coverage:** Unit, integration, routing, privacy, resilience, and provider testing.
- **Status:** 146 / 146 tests passing across 33 suites. 

## 20. DOCKER & INFRASTRUCTURE

- **Compose:** Contains `postgres`, `mongo`, `redis`, `soap-mock`, `api`, `worker`, and `frontend`.
- **Health Checks:** Strict dependencies enforce that the API waits for databases before booting.
- **Worker:** The `worker` container currently runs a placeholder script and will constantly restart until real BullMQ processing logic is merged. 

## 21. ENVIRONMENT VARIABLES

| Variable | Purpose | Required | Secret |
|---|---|---|---|
| `DATABASE_URL` | PostgreSQL connection | Yes | Yes |
| `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_DB` | Compose Postgres credentials | Yes (Compose) | Yes |
| `MONGODB_URL` | MongoDB connection | Yes | Yes |
| `REDIS_URL` | Redis connection | Yes | Yes |
| `JWT_SECRET` | JWT token signing | Yes | Yes |
| `CORS_ORIGINS` | Permitted origins | Yes | No |
| `SOAP_MOCK_URL`| Legacy system target | Optional | No |
| `OPENAI_API_KEY` | OpenAI provider auth | If enabled | Yes |
| `GEMINI_API_KEY`| Gemini AI provider auth | If enabled | Yes |
| `VITE_API_BASE_URL` | Frontend API prefix (public) | No | No |

## 22. SECURITY REVIEW

**Security Strengths:**
- Raw passwords and AI API keys are never stored in databases or logs.
- Strict multi-tenancy rules (`organizationId` binding) prevent cross-tenant access.
- Parameterized SQL queries mitigate SQL injection.
- Centralized deterministic privacy scanning guarantees redaction prior to third-party API exposure.
- JWTs are short-lived.

**Security Items to Review Before Production:**
- Replace the dummy `JWT_SECRET` in `.env` with a highly entropic key.
- Update `CORS_ORIGINS` to remove `localhost` and reflect real production domains.
- Serve all traffic over HTTPS (TLS termination required at load balancer).

## 23. CURRENT KNOWN LIMITATIONS

- **No HTTPS Termination:** Currently relies on reverse proxies/load balancers to terminate TLS.
- **Background Worker Placeholder:** Bulk AI operations or heavy background tasks aren't actually offloaded to the worker yet.
- **No Live Internet Deployment:** Only verified locally. 
- **Production Databases:** Requires fully managed database services with automated backups for a real launch.

## 24. DEPLOYMENT READINESS

| Component | Status | Note |
|---|---|---|
| Infrastructure | NEEDS VERIFICATION | Needs public IP/Load Balancer |
| Database/Redis/Mongo | NOT READY | Migrate to managed cloud instances |
| Environment/Secrets | NOT READY | Move to secret manager |
| Docker | READY | Compose file is solid |
| Frontend/API | READY | Ready to serve |
| HTTPS/CORS | NOT READY | Needs certificates and origin updates |
| Migrations | READY | Automated scripts work |
| Monitoring/Backups | NOT READY | Requires infrastructure hooks |

## 25. FINAL ARCHITECTURE DIAGRAM

```mermaid
graph TD
    User[User / AI Agent] --> Frontend[React Frontend]
    User --> API[API / Gateway REST Client]
    Frontend --> API
    
    subgraph AegisAI Logical Services
    Identity[Identity & Access]
    Gateway[AI Gateway]
    Privacy[Privacy Scanner]
    Policy[Policy & Approval]
    Provider[Model & Provider]
    Security[Security & Audit]
    end
    
    API --> Gateway
    Gateway --> Identity
    Gateway --> Privacy
    Gateway --> Policy
    Gateway --> Provider
    Gateway --> Security
    
    Identity --> PG[(PostgreSQL)]
    Gateway --> PG
    Gateway --> Redis[(Redis)]
    Policy --> PG
    Provider --> PG
    Privacy --> Mongo[(MongoDB)]
    Security --> Mongo
    
    Provider --> Gemini[Gemini API]
    Provider --> OpenAI[OpenAI API]
    Identity --> SOAP[Legacy SOAP System]
```

## 26. PROFESSOR / VIVA SUMMARY

**How to Explain AegisAI in 2 Minutes:**
"AegisAI is an enterprise control plane that secures and governs outbound AI traffic. Instead of developers calling OpenAI or Gemini directly—risking PII leaks and unbounded costs—they call AegisAI. AegisAI authenticates the request, checks rate limits, scans for and masks sensitive data like API keys or social security numbers, evaluates custom organizational policies to approve or block the prompt, and finally routes it safely to the provider using circuit breakers. It provides an immutable audit trail using a microservice-ready modular monolith architecture backed by PostgreSQL, MongoDB, and Redis."

**Important Questions Professor May Ask:**
1. *Why use MongoDB and PostgreSQL?* Postgres handles strict relational data like orgs and policies. Mongo handles unstructured/highly-nested data like traces and audit logs.
2. *How is Idempotency handled?* Redis stores a hash of the `Idempotency-Key`. If the exact same request arrives, the cached response is returned immediately.
3. *What happens if the AI Provider goes down?* The `cockatiel` circuit breaker trips after 5 failures, returning a fast 503 instead of hanging the system, and tests recovery automatically.
4. *How do you prevent data leaks?* The Privacy Scanner uses deterministic regex to find PII. Depending on the policy, it can automatically replace the data with `[MASKED_EMAIL]`, or block the request entirely.
5. *Why is the SOAP integration there?* To prove legacy enterprise interoperability by dynamically checking employee status over XML/WSDL before allowing secure requests.

## 27. DEPLOYMENT NEXT STEPS

**Next Step — Deployment (High Level Plan)**
- **Phase A — Production Preparation:** Procure domains, SSL certificates, and cloud infrastructure.
- **Phase B — Databases:** Provision managed PostgreSQL, MongoDB, and Redis instances. Configure automated backups.
- **Phase C — Secrets:** Inject `.env` values into a Secret Manager (e.g., AWS Secrets Manager).
- **Phase D — Backend Deployment:** Push Docker images to a registry, deploy `api` containers behind a Load Balancer terminating HTTPS.
- **Phase E — Frontend Deployment:** Build the Vite SPA and deploy to a CDN (e.g., Vercel, S3+CloudFront). Update CORS origins on the API.
- **Phase F — Smoke Testing:** Run critical path tests against the live endpoint.

## 28. SOURCE OF TRUTH RULE

This document was generated based on the *current* state of the repository's code, tests, and configuration. All implementations documented above (Privacy Sandbox, Legacy Integration, Settings, Resilience) accurately match the active TypeScript files running in `apps/api`. No functionality was hallucinated or assumed from outdated planning documents.
