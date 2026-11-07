# AegisAI — Enterprise AI Security & Governance Gateway

AegisAI is an enterprise-grade security and governance control plane situated between client applications / AI agents and foundation model providers. It authenticates callers, validates and rate-limits requests, scans for sensitive data and secrets, evaluates organizational AI policies, dynamically routes to approved models with resilience protection, and maintains an immutable audit and trace record.

---

## Architecture at a Glance

The system is organized into **six logical services**, each strictly owning its data and communicating exclusively via typed contract interfaces:

1. **Identity & Access Management (`apps/identity-service`)** — Organization multi-tenancy, salted bcrypt user authentication, HS256 JWT tokens, RBAC roles (`ORGANIZATION_ADMIN`, `DEVELOPER`, `SECURITY_AUDITOR`), service accounts, and legacy SOAP/WSDL directory integration. *Owns: PostgreSQL `organizations`, `users`, `service_accounts`, `organization_settings`.*
2. **AI Request Gateway (`apps/gateway-service`)** — Central entry point (`/v1/ai-requests`), pipeline orchestration, request lifecycle management, Redis distributed idempotency (`Idempotency-Key`), and token-bucket rate limiting. *Owns: PostgreSQL `ai_requests`.*
3. **Privacy Scanner (`apps/privacy-service`)** — Deterministic detection of PII (emails, phone numbers, Indian PAN/Aadhaar, credit cards) and secrets (API keys, passwords, bearer tokens). Offers zero-retention sandbox scanning and back-to-front token masking. *Owns: MongoDB `scanner_results`.*
4. **Policy & Approval Governance (`apps/policy-service`)** — Rule evaluation on prompt findings and sensitivity. Enforces governance actions: `ALLOW`, `BLOCK`, `MASK`, `REQUIRE_APPROVAL`, `ROUTE`. Handles human-in-the-loop approval workflows. *Owns: PostgreSQL `policies`, `approvals`.*
5. **Model & Provider Management (`apps/model-provider-service`)** — Decoupled catalog of AI providers and models. Performs sensitivity-based routing ($\text{Model Sensitivity} \ge \text{Prompt Sensitivity}$) and executes outbound calls via resilient adapters wrapped in Cockatiel (30s timeout, exponential backoff retries with jitter, 5-failure circuit breaker). Supports Google Gemini, OpenAI, and a built-in Mock Provider. *Owns: PostgreSQL `providers`, `models`.*
6. **Security, Audit & Observability (`apps/security-audit-service`)** — Correlated request tracing (`x-correlation-id`), security event alerts, and queryable audit trails. *Owns: MongoDB `request_traces`, `security_events`, `audit_events`.*

The control plane user interface is a responsive **React / Vite / TypeScript** dashboard hosted in `apps/frontend`.

---

## Repository Layout

```text
apps/
  api/                     Express host application — mounts service routers and GraphQL
  identity-service/        Authentication, JWT, RBAC, legacy SOAP client, PostgreSQL
  gateway-service/         AI request lifecycle, Redis idempotency, pipeline coordinator
  privacy-service/         PII and secret detection engine, token redaction, MongoDB
  policy-service/          Policy evaluation engine, approvals workflow, PostgreSQL
  model-provider-service/  Model registry, Gemini/OpenAI/Mock adapters, Cockatiel resilience
  security-audit-service/  Distributed tracing, security events, audit logging, MongoDB
  worker/                  Background processing placeholder
  frontend/                React / Vite control-plane dashboard (port 5173 / port 80)
packages/
  config/                  Typed environment configuration loader & startup validator
  shared-types/            Cross-service types, DTOs, and ServiceContract interfaces
  schemas/                 AJV validation schemas
openapi/                   OpenAPI 3.0 specification document
docker/                    Docker Compose orchestration and container Dockerfiles
soap-mock/                 Mock legacy enterprise SOAP/WSDL employee verification service
scripts/                   Database migration runner, admin seed, and verification test suites
docs/                      Architecture contracts, setup guides, and demonstration protocols
```

---

## Technology Stack

- **Backend Runtime:** Node.js (>= 20), TypeScript, Express.js
- **Datastores:** PostgreSQL 16 (relational data), MongoDB 7 (event & audit data), Redis 7 (idempotency, rate limiting, cache)
- **Security & Validation:** JWT (jsonwebtoken), bcrypt, AJV, Helmet, CORS
- **Resilience:** Cockatiel (circuit breakers, retry policies, timeouts)
- **APIs:** REST (`/v1`), GraphQL Apollo Server (`/v1/graphql`), SOAP/WSDL (`node-soap`)
- **Frontend:** React 19, Vite, TailwindCSS, Apollo Client, Lucide React
- **Testing:** Jest, Supertest, ts-jest, in-memory repository fakes, mocked provider adapters

---

## Quick Start Guide

### 1. Prerequisites
- Node.js >= 20.x
- npm >= 10.x
- Docker & Docker Compose (for PostgreSQL, MongoDB, Redis datastores)
- Git

### 2. Installation & Environment Setup
Clone the repository and install all dependencies:

```bash
git clone <repository-url>
cd aegisai
npm install
```

Copy the environment template to create your local `.env` file (actual credentials must never be committed to Git):

```bash
# On Linux / macOS / Git Bash:
cp .env.example .env

# On Windows PowerShell:
Copy-Item .env.example .env
```

Review `.env` and configure your local settings:
- Set `POSTGRES_PASSWORD` and update `DATABASE_URL` with your local PostgreSQL password.
- Generate a local `JWT_SECRET`:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```
- Set `SEED_ADMIN_EMAIL` (e.g. `admin@aegisai.local`) and `SEED_ADMIN_PASSWORD` (e.g. your local secret).
- *(Optional)* Add your `GEMINI_API_KEY` for live Google Gemini testing. If omitted, the system seamlessly uses the zero-credential `mock-provider`.

### 3. Run Automated Validation & Tests
Verify code health, build, and test suites across all packages and services:

```bash
# Check TypeScript types across all workspaces
npm run typecheck

# Run all 39 Jest test suites (187 automated tests)
npm test

# Build production bundles for backend services and frontend
npm run build
```

### 4. Start Infrastructure & Datastores
Launch the PostgreSQL, MongoDB, Redis, and SOAP mock containers:

```bash
docker compose -f docker/docker-compose.yml --env-file .env up -d postgres mongo redis soap-mock
```

Apply database migrations and seed default catalog models:

```bash
# Run PostgreSQL migrations across Identity, Gateway, Policy, and Model services
npm run db:migrate

# Seed default AI providers (Mock, OpenAI, Gemini) and models
npm run db:seed

# Seed the initial administrator user from SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD
npm run db:seed:admin
# or directly: node scripts/seed_user.js

# Optional: Run local refinements & security verification suite
node scripts/verify_refinements.js
```

### 5. Start Backend and Frontend
In terminal 1, start the API server:
```bash
npm run dev
# The API Gateway is ready at http://localhost:4000
```

In terminal 2, start the React dashboard:
```bash
npm run dev -w apps/frontend
# The Web Dashboard is ready at http://localhost:5173
```

Log in to the dashboard at `http://localhost:5173` using your seeded administrator credentials or register a new account.

---

## Core Application Flows & User Journeys

AegisAI provides an end-to-end security pipeline and smooth developer experience:

### 1. Instant User Registration & Auto-Login Flow
- **Seamless Onboarding:** When a new user registers via `/v1/auth/signup`, the backend creates their user account, provisions their tenant organization, and immediately signs an HS256 JWT access token.
- **Immediate Dashboard Access:** The React frontend automatically stores the token, updates `AuthContext`, and transitions the user directly to `/dashboard` without manual login friction.
- **Security & Verification Tracking:** Unverified email accounts maintain `email_verified: false` and generate cryptographic verification tokens, enabling continuous compliance auditing and email confirmation workflows without blocking initial developer evaluation.

### 2. End-to-End AI Gateway Request Pipeline (`POST /v1/ai-requests`)
Every outbound AI generation request passes through a 5-stage synchronous governance pipeline:
1. **Authentication & Idempotency:** The gateway validates the Bearer JWT, enforces RBAC permissions, checks rate limits via Redis token buckets, and validates the `Idempotency-Key` header against Redis cache to prevent duplicate billing.
2. **Privacy & DLP Scanning:** The `privacy-service` deterministically scans input prompts for PII (emails, phone numbers, credit cards, Indian PAN/Aadhaar) and secrets (API keys, private keys, passwords). Sensitive data can be masked back-to-front before provider dispatch.
3. **Policy Evaluation:** The `policy-service` applies organizational rules against detected sensitivity and content. Actions include `ALLOW`, `BLOCK` (HTTP 403), `MASK`, or `REQUIRE_APPROVAL` (HTTP 202).
4. **Resilient Model Routing:** The `model-provider-service` resolves approved models with suitable sensitivity levels ($\text{Model Sensitivity} \ge \text{Prompt Sensitivity}$) and dispatches outbound calls through Cockatiel-wrapped adapters featuring 30s timeouts, exponential backoff with jitter (3 retries), and 5-failure circuit breakers.
5. **Observability & Distributed Tracing:** The `security-audit-service` correlates the entire lifecycle under a unified `x-correlation-id`, logging request traces, security detections, and immutable audit entries in MongoDB.

### 3. Human-in-the-Loop Approval Governance
- Requests flagged with `REQUIRE_APPROVAL` pause execution in a `PENDING` state and surface immediately on the React dashboard.
- Designated `ORGANIZATION_ADMIN` users review the blocked prompt, inspect detected risk factors, and approve or reject the request.
- Approved requests seamlessly resume through the gateway to the model provider, returning completed AI output to the caller.

### 4. Enterprise Legacy System Integration (SOAP/WSDL)
- AegisAI integrates modern REST/GraphQL workflows with enterprise directories via a dedicated SOAP 1.1 connector (`LegacyEmployeeClient`).
- Features real WSDL parsing, XML serialization, and independent Cockatiel timeout and retry policies for legacy identity reconciliation.

---

## Documentation Links

- [Complete Technical Overview](docs/AegisAI-Complete-Project-Overview.md) — System architecture, technology stack, microservice deep dive, and compliance matrix.
- [Operator & User Guide](docs/AegisAI-Operator-Guide.md) — Setup, user journeys (authentication, registration, recovery), dashboard navigation, and operations.
- [REST API Demonstration Guide](docs/AegisAI-REST-API-Demonstration-Guide.md) — Laboratory demonstration scripts, cURL commands, and request flows.
- [GitHub Setup & Evaluation Guide](docs/github-setup.md) — Step-by-step instructions for cloning, configuring, and testing.
- [Database Ownership](docs/database-ownership.md) — Multi-database architecture across PostgreSQL, MongoDB, and Redis.
- [28-Requirement Checklist Mapping](docs/checklist-mapping.md) — Coursework requirements matrix and C1–C5 specifications.
- [28-Requirement Final Evidence Matrix](docs/final-evidence-matrix.md) — Verification evidence, demo commands, and component mappings.
- [Interactive Swagger Docs](http://localhost:4000/docs) — OpenAPI 3.0 UI rendered directly from the running gateway.

---

## Security Best Practices Followed

- **Zero Hardcoded Credentials:** All secrets (database passwords, JWT keys, Gemini API keys) are strictly loaded from environment variables.
- **Backend Key Isolation:** AI provider keys (`GEMINI_API_KEY`) reside exclusively in server memory and are never exposed to the frontend bundle or query strings.
- **Strict Header Authentication:** Outbound Gemini requests strictly use `x-goog-api-key` HTTP headers over TLS; query string API key URLs are prohibited.
- **Log Redaction:** Pino structured logger scrubs all authentication headers, bearer tokens, passwords, and API keys from stdout.
- **Repository Hygiene:** `.gitignore` and `.dockerignore` comprehensively exclude all `.env` files, logs, keypairs, and database dumps.
