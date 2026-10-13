# AegisAI — GitHub Clone & Evaluation Setup Guide

This guide is designed for evaluators, professors, and contributors to inspect the implementation, configure a clean local environment from safe templates, run automated tests, and run the complete AegisAI stack locally.

---

## 1. System Architecture & Overview

AegisAI is an **Enterprise AI Security & Governance Gateway Control Plane** situated between enterprise AI applications/agents and foundation model providers.

### The Six Logical Services
Every service strictly owns its domain data and communicates across defined TypeScript contract interfaces:

1. **Identity & Access Management (`apps/identity-service`)**
   - User authentication, salted bcrypt password hashing, HS256 JWT access tokens, RBAC roles (`ORGANIZATION_ADMIN`, `DEVELOPER`, `SECURITY_AUDITOR`), service accounts, and session verification.
   - Interoperates with legacy enterprise directories via SOAP/WSDL.
   - Owns PostgreSQL tables: `organizations`, `users`, `service_accounts`, `organization_settings`.

2. **AI Request Gateway (`apps/gateway-service`)**
   - Public AI request entry point (`/v1/ai-requests`), orchestration pipeline, request lifecycle state machine, distributed idempotency via Redis, and rate limiting.
   - Owns PostgreSQL table: `ai_requests`.

3. **Privacy Scanner (`apps/privacy-service`)**
   - Deterministic PII, sensitive information, and secret detection engine (emails, phone numbers, credit cards, Indian PAN/Aadhaar, API keys, passwords, and custom organizational keywords).
   - Back-to-front token redaction and masking without data retention in sandbox mode.
   - Owns MongoDB collection: `scanner_results`.

4. **Policy & Approval Governance (`apps/policy-service`)**
   - Evaluates organizational governance rules against scan findings and prompt context.
   - Supported policy decisions: `ALLOW`, `BLOCK`, `MASK`, `REQUIRE_APPROVAL`, `ROUTE`.
   - Manages approval workflows for high-risk requests.
   - Owns PostgreSQL tables: `policies`, `approvals`.

5. **Model & Provider Management (`apps/model-provider-service`)**
   - Registry of AI providers and models, capability metadata, health monitoring, and dynamic sensitivity-based routing ($$\text{Model Approval Rank} \ge \text{Prompt Sensitivity Rank}$$).
   - Outbound provider adapters with resilience protection via `cockatiel` (30s timeout, exponential backoff with jitter, 5-failure circuit breaker).
   - Supported adapters: **Google Gemini API** (`gemini-3.8-flash`, `gemini-3.5-flash`), **OpenAI**, and **Mock Provider** (zero-credential fallback).
   - Owns PostgreSQL tables: `providers`, `models`.

6. **Security, Audit & Observability (`apps/security-audit-service`)**
   - Distributed correlation ID tracking (`x-correlation-id`), request traces, security event logging, and immutable audit logs.
   - Owns MongoDB collections: `request_traces`, `security_events`, `audit_events`.

---

## 2. Prerequisites

Before setting up the project, ensure your environment has:

- **Node.js**: `v20.x` or higher (verified on Node `v20` and `v22`)
- **npm**: `v10.x` or higher
- **Docker & Docker Compose**: For running PostgreSQL, MongoDB, Redis, and the SOAP mock service
- **Git**: For version control

---

## 3. Cloning & Initializing the Project

```bash
# Clone the repository
git clone <repository-url>
cd aegisai

# Install all workspace dependencies
npm install
```

---

## 4. Environment Configuration

All credentials and infrastructure endpoints are managed via environment variables. **Actual `.env` files are excluded from Git by `.gitignore`.**

Copy the safe example configuration template:

```bash
# Linux / macOS / Git Bash:
cp .env.example .env

# Windows PowerShell:
Copy-Item .env.example .env
```

### Key Configuration Variables in `.env`

| Variable | Description | Safe Default / Example | Required / Optional |
| :--- | :--- | :--- | :--- |
| `NODE_ENV` | Environment mode (`development`, `test`, `production`) | `development` | Required |
| `PORT` | Backend HTTP API port | `4000` | Required |
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://aegisai:your_password@localhost:5433/aegisai` | Required |
| `MONGODB_URL` | MongoDB connection string | `mongodb://localhost:27017/aegisai` | Required |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` | Required |
| `JWT_SECRET` | Secret key for signing and verifying JWT tokens | Generate random secret | Required |
| `CORS_ORIGINS` | Allowed CORS origins for the API | `http://localhost:5173,http://localhost:80` | Required |
| `GEMINI_API_KEY` | Google Gemini API key (server-side only) | Your Google AI Studio key | Optional (needed for live Gemini) |
| `OPENAI_API_KEY` | OpenAI API key (server-side only) | Your OpenAI key | Optional |
| `SEED_ADMIN_EMAIL` | Email for local seeded admin | `admin@aegisai.local` | Required for seed |
| `SEED_ADMIN_PASSWORD` | Password for local seeded admin | Your chosen local password | Required for seed |
| `VITE_API_BASE_URL` | Frontend API proxy path | `/v1` | Required for UI |

> **Security Note:** To generate a cryptographically strong local `JWT_SECRET`:
> ```bash
> node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
> ```

---

## 5. Running Automated Checks & Tests

AegisAI includes a comprehensive test suite covering service boundaries, authentication, RBAC, model routing, resilience patterns, and policy engines.

```bash
# 1. Typecheck all TypeScript code across the monorepo
npm run typecheck

# 2. Run the automated test suite (in-memory repositories & mocked providers)
npm test

# 3. Build production bundles for backend services and frontend
npm run build
```

*Note: All 38 test suites (167 unit and integration tests) execute cleanly in-memory without requiring external database connections or external API keys.*

---

## 6. Running the Local Stack

### Step 1: Start Datastores via Docker Compose
Ensure Docker Desktop is running, then launch the infrastructure containers:

```bash
# Start PostgreSQL, MongoDB, Redis, and Legacy SOAP mock
docker compose -f docker/docker-compose.yml --env-file .env up -d postgres mongo redis soap-mock
```

Verify containers are running:
```bash
docker compose -f docker/docker-compose.yml ps
```

### Step 2: Run Database Migrations and Seed Catalog
```bash
# Apply PostgreSQL schemas for Identity, Gateway, Policy, and Model services
npm run db:migrate

# Seed default AI providers (Mock, OpenAI, Gemini) and models
npm run db:seed

# Seed the local administrator account using credentials from your .env
node seed_user.js
```

### Step 3: Start the Backend API
```bash
# Starts the modular monolith API server on http://localhost:4000
npm run dev
# or specifically: npm run dev -w apps/api
```

Verify backend health:
```bash
curl http://localhost:4000/health
curl http://localhost:4000/v1/identity/health
curl http://localhost:4000/v1/gateway/health
curl http://localhost:4000/v1/privacy/health
curl http://localhost:4000/v1/policy/health
curl http://localhost:4000/v1/model-provider/health
curl http://localhost:4000/v1/security-audit/health
```

### Step 4: Start the Frontend Control Plane
In a separate terminal:
```bash
npm run dev -w apps/frontend
```
Open your browser at:
`http://localhost:5173`

Log in using the administrator email and password you defined in `.env` (`SEED_ADMIN_EMAIL` and `SEED_ADMIN_PASSWORD`).

---

## 7. Interactive API Documentation & Swagger

An interactive Swagger UI conforming to OpenAPI 3.0 is served directly by the backend API:

- **Swagger UI:** `http://localhost:4000/docs`
- **Raw OpenAPI Schema:** `http://localhost:4000/openapi.json`
- **GraphQL Apollo Explorer:** `http://localhost:4000/v1/graphql`

---

## 8. Provider Credentials & Zero-Key Operation

- **Zero-Credential Operation:** AegisAI does **not** require a paid AI provider account to evaluate or run. When `GEMINI_API_KEY` is not configured, the gateway routes AI requests to the built-in `mock-provider` (`mock-chat-standard`), fully exercising idempotency, rate limiting, privacy scanning, policy evaluation, auditing, and traces.
- **Live Google Gemini Operation:** To test live completions with Google Gemini (`gemini-3.8-flash`), set `GEMINI_API_KEY` in `.env`. The backend passes the key strictly via the `x-goog-api-key` header over TLS and sanitizes all error messages to guarantee no secrets leak into logs or client responses.
