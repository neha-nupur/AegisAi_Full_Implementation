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
# Check TypeScript types across all 9 workspaces
npm run typecheck

# Run all 38 Jest test suites (167 automated tests)
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
node seed_user.js
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

Log in to the dashboard at `http://localhost:5173` using the email and password you configured in `.env`.

---

## Documentation Links

- [GitHub Setup & Evaluation Guide](docs/github-setup.md) — Step-by-step instructions for cloning, configuring, and testing.
- [Architectural Contract (CLAUDE.md)](CLAUDE.md) — Service boundaries, communication contracts, and error envelopes.
- [REST API Demonstration Guide](docs/AegisAI-REST-API-Demonstration-Guide.md) — Curl examples, flow diagrams, and Postman test endpoints.
- [Interactive Swagger Docs](http://localhost:4000/docs) — OpenAPI 3.0 UI rendered directly from the running gateway.

---

## Security Best Practices Followed

- **Zero Hardcoded Credentials:** All secrets (database passwords, JWT keys, Gemini API keys) are strictly loaded from environment variables.
- **Backend Key Isolation:** AI provider keys (`GEMINI_API_KEY`) reside exclusively in server memory and are never exposed to the frontend bundle or query strings.
- **Strict Header Authentication:** Outbound Gemini requests strictly use `x-goog-api-key` HTTP headers over TLS; query string API key URLs are prohibited.
- **Log Redaction:** Pino structured logger scrubs all authentication headers, bearer tokens, passwords, and API keys from stdout.
- **Repository Hygiene:** `.gitignore` and `.dockerignore` comprehensively exclude all `.env` files, logs, keypairs, and database dumps.
