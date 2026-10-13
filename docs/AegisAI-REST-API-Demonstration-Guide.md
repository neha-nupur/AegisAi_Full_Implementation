# AegisAI REST API Demonstration Guide

> **Document Purpose:** Practical laboratory and viva demonstration guide for professors, evaluators, and system architects. Explains end-to-end request dispatch, HTTP methods, route handling, security interceptors, service contracts, data persistence, and live response inspection across the four primary operational domains of AegisAI: **AI Requests**, **Privacy Scanner**, **Models**, and **Providers**.

---

## 1. Purpose

This document provides a comprehensive, field-tested demonstration script and architectural reference for proving the operation of the **AegisAI Enterprise AI Security & Governance Gateway**. It maps user actions in the frontend dashboard, cURL terminal commands, and Swagger UI executions directly to the exact TypeScript routes, controllers, services, database tables, and HTTP status codes implemented in the repository.

### Core Demonstration Domains:
1. **AI Requests:** Gateway orchestration, AJV JSON schema validation, idempotency caching, rate limiting, synchronous pipeline execution, model routing, and provider invocation.
2. **Privacy Scanner:** Real-time deterministic detection of PII (Email, Phone, PAN, Aadhaar) and secrets (API Keys, Passwords), risk classification, redaction, and sandbox testing.
3. **Models:** Model catalog management, capability tags, sensitivity tiers, and cost metadata registered in PostgreSQL.
4. **Providers:** Upstream AI provider registry, endpoint configuration, health checks, and secure credential delegation (Gemini adapter).

---

## 2. AegisAI Request Architecture

AegisAI acts as a centralized control plane between client applications (frontends, backend services, or autonomous AI agents) and upstream Large Language Model providers. 

### Global Architecture Principles:
- **Strict Decoupling:** The browser/client never communicates directly with data stores (PostgreSQL, MongoDB, Redis) or upstream AI providers (Google Gemini, OpenAI).
- **Service Isolation:** Each logical service strictly owns its domain data. No service directly queries another service's database tables.
- **Correlation & Traceability:** Every request is assigned a UUID `x-correlation-id` at entry, propagated across all service boundaries, and stamped into response headers and audit logs.
- **Strict Status Semantics:** HTTP status codes strictly reflect the true state of execution (e.g., `201 Created` for resource persistence, `403 Forbidden` for policy violation, `409 Conflict` for idempotency collisions, `429 Too Many Requests` for rate limits).

```mermaid
graph TD
    User([Browser / AI Client]) -->|HTTP Request + JWT| Gateway[AegisAI REST API Gateway]
    
    subgraph Security & Pipeline Interceptors
        Gateway --> MW1[Correlation ID Generator]
        MW1 --> MW2[JWT Authentication & RBAC]
        MW2 --> MW3[Rate Limiting - Redis]
        MW3 --> MW4[Idempotency Check - Redis]
        MW4 --> MW5[AJV Schema Validation]
    end

    subgraph Service Layer Processing
        MW5 --> AIReqSvc[AI Requests Service]
        AIReqSvc --> PrivSvc[Privacy Scanner Service]
        PrivSvc -.->|MongoDB / Memory| MongoStore[(MongoDB: scanner_results)]
        AIReqSvc --> PolSvc[Policy Evaluation Service]
        AIReqSvc --> ModRouter[Model & Provider Router]
    end

    subgraph Infrastructure & External Calls
        ModRouter --> Adapter[Provider Adapter: Gemini / Mock]
        Adapter -->|HTTPS / API Key Header| GeminiAPI[Google Gemini API]
        AIReqSvc --> AuditSvc[Security & Audit Service]
    end

    subgraph Relational Data Persistence
        AIReqSvc --> PG[(PostgreSQL: ai_requests)]
        ModRouter --> PGModels[(PostgreSQL: models / providers)]
        AuditSvc --> PGAudit[(PostgreSQL: audit_events)]
    end

    AIReqSvc --> Response[JSON / XML Response Envelope]
    Response --> User
```

---

## 3. Frontend → Backend → Service → Database Flow

Every user action follows a deterministic, 7-layer execution hierarchy:

```mermaid
sequenceDiagram
    autonumber
    actor User as User / Professor
    participant UI as React Frontend
    participant API as Express API (/v1)
    participant Ctrl as Route Controller
    participant Svc as Core Domain Service
    participant DB as PostgreSQL / Redis / Mongo
    participant Ext as Upstream Provider (Gemini)

    User->>UI: Clicks Action (e.g. "Submit AI Request")
    UI->>UI: Reads JWT token from localStorage
    UI->>API: POST /v1/ai-requests (Headers: Bearer Token, Idempotency-Key)
    API->>API: Verify JWT signature & organizationId
    API->>DB: Check Redis rate limit & idempotency key
    API->>API: AJV validate request body against schema
    API->>Ctrl: Dispatch to AiRequestsController.submit()
    Ctrl->>Svc: Call AiRequestsService.submit()
    Svc->>DB: INSERT into ai_requests (status = 'RECEIVED')
    Svc->>Svc: Run Privacy Scanner & Policy Engine
    Svc->>Ext: Invoke upstream provider via Adapter
    Ext-->>Svc: LLM Generated Response
    Svc->>DB: UPDATE ai_requests (status = 'COMPLETED')
    Svc-->>Ctrl: Return completed AIRequest entity
    Ctrl-->>API: Set status 201 Created + ETag
    API-->>UI: Response Envelope: { data: {...}, traceId: "..." }
    UI-->>User: Visual update on Dashboard
```

---

## 4. AI Requests — Detailed Demonstration

The AI Requests gateway orchestrates the complete governance lifecycle of generative AI interactions.

### 4.1 Create AI Request (`POST /v1/ai-requests`)

#### A. Endpoint Specification:
- **HTTP Method:** `POST`
- **Route:** `/v1/ai-requests`
- **API Version:** `v1`
- **Authentication:** `Bearer <JWT_TOKEN>` (Required)
- **Required Headers:**
  - `Content-Type: application/json`
  - `Authorization: Bearer <TOKEN>`
  - `Idempotency-Key: <UUID_OR_STRING>`
- **Permissions Required:** `ai_requests:write`

#### B. Request Body Schema (AJV Validated):
Source: `packages/schemas/src/ai-requests.ts`
```json
{
  "input": "Summarize the key security benefits of using AegisAI.",
  "modelPreference": "auto",
  "policyId": "policy_default"
}
```
*Note:* `input` is mandatory (length 1–20,000). `modelPreference` defaults to `"auto"`. `policyId` is optional.

#### C. Processing Pipeline Execution:
1. **Frontend:** Handled in `apps/frontend/src/pages/NewAiRequestPage.tsx` via `handleSubmit()`. Calls `api.post('/ai-requests', payload, { 'Idempotency-Key': ... })`.
2. **Middleware Interception:**
   - `authenticateJWT`: Validates token signature, extracts user and organization ID.
   - `rateLimitMiddleware`: Increments Redis key `ratelimit:<orgId>:<window>`. Returns `429` if exceeded.
   - `idempotencyMiddleware`: Verifies `Idempotency-Key` header. Returns `409` if concurrently processing, or cached result if previously completed.
   - `validateBody(validateCreateAIRequest)`: Compiles schema via AJV; rejects malformed inputs with `400`.
3. **Controller:** `AiRequestsController.submit` in `apps/gateway-service/src/controllers/ai-requests.controller.ts`.
4. **Service:** `AiRequestsService.submit()` in `apps/gateway-service/src/services/ai-requests.service.ts`:
   - Persists state `RECEIVED` into PostgreSQL table `ai_requests`.
   - Transitions to `VALIDATED`.
   - Executes `privacyScanService.scanAndRecord()`.
   - Evaluates organizational governance policy via `policyEvaluationService.evaluate()`.
   - If policy decision is `BLOCK`: transitions request to `BLOCKED`, throws `HttpError(403)`.
   - If policy decision is `REQUIRE_APPROVAL`: transitions to `APPROVAL_REQUIRED`, creates `Approval` record, halts pipeline.
   - If `ALLOW`/`MASK`: redacts input if necessary, routes to best active model (`gemini-3.8-flash`), calls `GeminiProviderAdapter.generate()`.
   - Persists final status `COMPLETED` and LLM output.
5. **Database Interaction:** PostgreSQL table `ai_requests`.
6. **Provider Interaction:** HTTPS call to `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent`.

#### D. Success Response Body (`201 Created`):
```json
{
  "data": {
    "id": "e4b3c2a1-89ab-4cde-0123-456789abcdef",
    "organizationId": "aegisai-demo-org",
    "requesterId": "usr_admin_001",
    "input": "Summarize the key security benefits of using AegisAI.",
    "modelPreference": "auto",
    "policyId": "policy_default",
    "status": "COMPLETED",
    "modelId": "gemini-3.8-flash",
    "providerId": "gemini-provider",
    "traceId": "c1c70eb3-4b8d-4e67-90ec-064c83179aff",
    "output": "AegisAI provides enterprise-grade governance, PII masking, policy enforcement...",
    "errorMessage": null,
    "createdAt": "2026-10-12T10:15:30.000Z",
    "updatedAt": "2026-10-12T10:15:32.000Z"
  },
  "traceId": "c1c70eb3-4b8d-4e67-90ec-064c83179aff"
}
```

---

### 4.2 List AI Requests (`GET /v1/ai-requests`)

#### A. Endpoint Specification:
- **HTTP Method:** `GET`
- **Route:** `/v1/ai-requests`
- **Query Parameters:**
  - `limit` (integer, default `20`, max `100`)
  - `cursor` (string, ISO timestamp for pagination)
- **Permissions Required:** `ai_requests:read`
- **Headers Returned:**
  - `Cache-Control: private, no-cache` (Enforced by `cacheControlMiddleware`)
  - `ETag: W/"..."` (Weak entity tag computed from payload hash)

#### B. Response Body (`200 OK`):
```json
{
  "data": [
    {
      "id": "e4b3c2a1-89ab-4cde-0123-456789abcdef",
      "status": "COMPLETED",
      "modelId": "gemini-3.8-flash",
      "providerId": "gemini-provider",
      "traceId": "c1c70eb3-4b8d-4e67-90ec-064c83179aff",
      "createdAt": "2026-10-12T10:15:30.000Z",
      "updatedAt": "2026-10-12T10:15:32.000Z"
    }
  ],
  "meta": {
    "nextCursor": null,
    "limit": 20
  },
  "traceId": "9b94970c-2905-4f41-a55b-fca1844afd7f"
}
```

---

### 4.3 Get Single AI Request (`GET /v1/ai-requests/:id`)

#### A. Endpoint Specification:
- **HTTP Method:** `GET`
- **Route:** `/v1/ai-requests/:id`
- **Path Parameter:** `id` (UUID)
- **Permissions Required:** `ai_requests:read`
- **Cache-Control:** `private, max-age=30`
- **Conditional GET:** Supports `If-None-Match` header. If matching ETag is sent, returns `304 Not Modified` with zero body.

#### B. Response Body (`200 OK`):
```json
{
  "data": {
    "id": "e4b3c2a1-89ab-4cde-0123-456789abcdef",
    "organizationId": "aegisai-demo-org",
    "requesterId": "usr_admin_001",
    "input": "Summarize the key security benefits of using AegisAI.",
    "modelPreference": "auto",
    "policyId": "policy_default",
    "status": "COMPLETED",
    "modelId": "gemini-3.8-flash",
    "providerId": "gemini-provider",
    "traceId": "c1c70eb3-4b8d-4e67-90ec-064c83179aff",
    "output": "AegisAI provides enterprise-grade governance...",
    "errorMessage": null,
    "createdAt": "2026-10-12T10:15:30.000Z",
    "updatedAt": "2026-10-12T10:15:32.000Z"
  },
  "traceId": "c1c70eb3-4b8d-4e67-90ec-064c83179aff"
}
```

---

### 4.4 Status Codes Implemented for AI Requests

| Status Code | Reason | Verified Condition in Implementation |
| :--- | :--- | :--- |
| **`200 OK`** | Success | Returned on `GET /v1/ai-requests` and `GET /v1/ai-requests/:id`. |
| **`201 Created`** | Created | Returned on `POST /v1/ai-requests` after successful pipeline execution. |
| **`304 Not Modified`** | Cached | Returned when `If-None-Match` header matches response ETag. |
| **`400 Bad Request`** | Validation Error | Sent when request body violates AJV schema (e.g. empty `input`) or missing `Idempotency-Key`. |
| **`401 Unauthorized`** | Auth Missing | Sent when `Authorization: Bearer` token is missing, expired, or tampered. |
| **`403 Forbidden`** | Policy Blocked | Sent when Policy evaluation returns `BLOCK` (e.g., detected secrets). |
| **`404 Not Found`** | Resource Missing | Sent when request ID does not exist or belongs to another organization. |
| **`409 Conflict`** | Idempotency Collision | Sent when same `Idempotency-Key` is re-sent while initial request is still processing. |
| **`429 Too Many Requests`** | Rate Limit | Sent when client exceeds limit (default: 100 req/min in Redis). Returns `Retry-After`. |
| **`502 Bad Gateway`** | Upstream Failure | Sent when downstream AI Provider fails or times out after maximum retries. |

---

### 4.5 Demonstrating Safe Error Scenarios to the Professor

#### Scenario 1: Triggering `400 Bad Request` (Missing Idempotency-Key or Empty Input)
Send a POST request without the required `Idempotency-Key` header:
```bash
curl -X POST "http://localhost:4000/v1/ai-requests" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"input": "Test prompt"}'
```
*Backend response:*
```json
{
  "error": {
    "code": "MISSING_IDEMPOTENCY_KEY",
    "message": "Idempotency-Key header is required for this operation."
  }
}
```

#### Scenario 2: Triggering `401 Unauthorized`
Send a request with an invalid token:
```bash
curl -X GET "http://localhost:4000/v1/ai-requests" \
  -H "Authorization: Bearer invalid_or_expired_jwt_token"
```
*Backend response:* Status `401 Unauthorized`.

#### Scenario 3: Triggering `403 Forbidden` (Policy Block on Secrets)
Submit an AI request containing a detected API secret key (e.g. dummy test key token):
```bash
curl -X POST "http://localhost:4000/v1/ai-requests" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "Idempotency-Key: demo-key-block-01" \
  -H "Content-Type: application/json" \
  -d '{"input": "Here is my secret AWS key: AKIAIOSFODNN7EXAMPLE"}'
```
*Backend response:*
```json
{
  "error": {
    "code": "POLICY_BLOCK",
    "message": "This request was blocked by policy.",
    "details": {
      "reason": "Request contains blocked secret patterns"
    }
  }
}
```

#### Scenario 4: Triggering `304 Not Modified`
1. Fetch request: `curl -I -H "Authorization: Bearer <TOKEN>" http://localhost:4000/v1/ai-requests/<ID>`
2. Copy `ETag` (e.g. `W/"7a3f89b12e4d01c8"`).
3. Re-run:
```bash
curl -I -X GET "http://localhost:4000/v1/ai-requests/<ID>" \
  -H "Authorization: Bearer <TOKEN>" \
  -H "If-None-Match: W/\"7a3f89b12e4d01c8\""
```
*Backend response:* `HTTP/1.1 304 Not Modified`.

---

## 5. Privacy Scanner — Detailed Demonstration

The Privacy Scanner Service performs real-time deterministic entity extraction without relying on external cloud APIs or storing raw user secrets.

### 5.1 Dual Execution Architecture

The Privacy Scanner functions in **two distinct execution modes**:
1. **Pipeline Execution:** Automatically invoked inside `AiRequestsService.submit()` for every inbound AI request. Results and findings are persisted in MongoDB (`scanner_results`).
2. **Interactive Sandbox REST API:** Directly callable via `POST /v1/privacy/scan` from the dashboard sandbox. Deliberately does **not** persist findings to database to prevent raw secrets from entering storage.

---

### 5.2 Sandbox Endpoint (`POST /v1/privacy/scan`)

- **HTTP Method:** `POST`
- **Route:** `/v1/privacy/scan`
- **Authentication:** `Bearer <JWT_TOKEN>`
- **Handler:** `scanSandbox` in `apps/privacy-service/src/controllers/scan.controller.ts`
- **Service Class:** `PrivacyScanner` in `apps/privacy-service/src/domain/scanner.ts`

#### A. Request Body:
```json
{
  "text": "Please contact Rahul Sharma at rahul.sharma@example.com or call 9876543210. My PAN is ABCDE1234F."
}
```

#### B. Processing Sequence:
```mermaid
graph TD
    Client[Frontend Sandbox] -->|POST /v1/privacy/scan| Controller[scan.controller.ts]
    Controller --> Scanner[PrivacyScanner.scan]
    
    subgraph Deterministic Entity Detection
        Scanner --> D1[Structural: EMAIL Regex]
        Scanner --> D2[Structural: Indian Phone Regex]
        Scanner --> D3[Structural: Indian PAN Regex]
        Scanner --> D4[Structural: Aadhaar Regex]
        Scanner --> D5[Structural: API Key / Secret Regex]
        Scanner --> D6[Dictionary: Sensitive Keywords]
    end

    Scanner --> Overlap[resolveOverlaps: Keep Highest Confidence]
    Overlap --> Redact[PrivacyScanner.redact: Back-to-Front Span Masking]
    Redact --> Response[Return JSON with Findings and Masked Text]
    Response --> Client
```

#### C. Response Body (`200 OK`):
```json
{
  "data": {
    "detected": true,
    "findingCount": 3,
    "findingTypes": ["EMAIL", "PHONE", "PAN"],
    "findings": [
      {
        "type": "EMAIL",
        "location": { "field": "input", "start": 31, "end": 55 },
        "confidence": 0.95,
        "action": "MASK"
      },
      {
        "type": "PHONE",
        "location": { "field": "input", "start": 64, "end": 74 },
        "confidence": 0.85,
        "action": "MASK"
      },
      {
        "type": "PAN",
        "location": { "field": "input", "start": 86, "end": 96 },
        "confidence": 0.9,
        "action": "MASK"
      }
    ],
    "maskedText": "Please contact Rahul Sharma at [REDACTED_EMAIL] or call [REDACTED_PHONE]. My PAN is [REDACTED_PAN]."
  }
}
```

#### D. Privacy Scanner Status Codes:
- **`200 OK`:** Successful scan completed.
- **`400 Bad Request`:** Missing or non-string `text` field in request body.
- **`401 Unauthorized`:** Missing or invalid JWT authorization header.

---

## 6. Models — Detailed CRUD Demonstration

The Model catalog defines available LLMs, their capability classifications (e.g. `text-generation`, `chat`), sensitivity rating, and cost metadata.

### 6.1 Status of CRUD Operations in Codebase

| Operation | Implemented in Backend | Implemented in Frontend | Route |
| :--- | :--- | :--- | :--- |
| **CREATE** | **Yes** | **Yes** | `POST /v1/model-provider/models` |
| **READ (List)** | **Yes** | **Yes** | `GET /v1/model-provider/models` |
| **READ (Single)**| **Yes** | Backend Route Only | `GET /v1/model-provider/models/:id` |
| **UPDATE** | Repository Only | UI Attempts `PATCH` | *Partially Implemented* (Route not mounted in Router) |
| **DELETE** | Not in Router | UI Attempts `DELETE` | *Partially Implemented* (Route not mounted in Router) |

> [!NOTE]
> In the Model & Provider service router (`apps/model-provider-service/src/routes/model.routes.ts`), `GET /`, `POST /`, and `GET /:id` are actively mounted. The repository `PgModelRepository` contains the `update()` method. The frontend UI modal provides edit/delete buttons, but backend router routes `PATCH` and `DELETE` are not yet bound. For your demonstration, focus on **CREATE** and **READ**, and highlight your deep understanding of this exact boundary!

---

### 6.2 CREATE MODEL (`POST /v1/model-provider/models`)

- **HTTP Method:** `POST`
- **Route:** `/v1/model-provider/models`
- **Controller:** `ModelController.createModel` (`apps/model-provider-service/src/controllers/model.controller.ts`)
- **Database:** PostgreSQL table `models`
- **Required Permission:** `organizations:write`

#### A. Request Body:
```json
{
  "providerId": "e1f2a3b4-5678-90ab-cdef-1234567890ab",
  "name": "gemini-1.5-pro",
  "capabilities": ["chat", "code", "reasoning"],
  "sensitivityLevel": "medium",
  "costMetadata": {
    "inputCostPer1k": 0.00125,
    "outputCostPer1k": 0.005,
    "currency": "USD"
  },
  "active": true,
  "configuration": {
    "apiModelName": "gemini-1.5-pro"
  }
}
```

#### B. Response Body (`201 Created`):
```json
{
  "data": {
    "id": "789abcde-0123-4567-89ab-cdef01234567",
    "providerId": "e1f2a3b4-5678-90ab-cdef-1234567890ab",
    "name": "gemini-1.5-pro",
    "capabilities": ["chat", "code", "reasoning"],
    "sensitivityLevel": "medium",
    "costMetadata": {
      "inputCostPer1k": 0.00125,
      "outputCostPer1k": 0.005,
      "currency": "USD"
    },
    "active": true,
    "configuration": {
      "apiModelName": "gemini-1.5-pro"
    },
    "createdAt": "2026-10-12T10:20:00.000Z",
    "updatedAt": "2026-10-12T10:20:00.000Z"
  },
  "traceId": "c1c70eb3-4b8d-4e67-90ec-064c83179aff"
}
```

---

### 6.3 READ MODELS (`GET /v1/model-provider/models`)

- **HTTP Method:** `GET`
- **Route:** `/v1/model-provider/models`
- **Controller:** `ModelController.listModels`
- **Database:** Executes `SELECT id, provider_id, name, capabilities, sensitivity_level, cost_metadata, active, configuration, created_at, updated_at FROM models ORDER BY name ASC`

#### Response Body (`200 OK`):
```json
{
  "data": [
    {
      "id": "m1111111-1111-1111-1111-111111111111",
      "providerId": "p1111111-1111-1111-1111-111111111111",
      "name": "gemini-3.8-flash",
      "capabilities": ["chat", "text-generation"],
      "sensitivityLevel": "low",
      "costMetadata": {
        "inputCostPer1k": 0.0001,
        "outputCostPer1k": 0.0004,
        "currency": "USD"
      },
      "active": true,
      "configuration": {
        "apiModelName": "gemini-3.8-flash"
      },
      "createdAt": "2026-09-01T00:00:00.000Z",
      "updatedAt": "2026-09-01T00:00:00.000Z"
    }
  ],
  "traceId": "9b94970c-2905-4f41-a55b-fca1844afd7f"
}
```

---

## 7. Providers — Detailed CRUD Demonstration

The Provider entity maintains the upstream service endpoints, connectivity adapters, and priority weights for automatic model routing.

### 7.1 Status of CRUD Operations in Codebase

| Operation | Implemented in Backend | Implemented in Frontend | Route |
| :--- | :--- | :--- | :--- |
| **CREATE** | **Yes** | **Yes** | `POST /v1/model-provider/providers` |
| **READ (List)** | **Yes** | **Yes** | `GET /v1/model-provider/providers` |
| **READ (Single)**| **Yes** | Backend Route Only | `GET /v1/model-provider/providers/:id` |
| **UPDATE** | Repository Only | UI Attempts `PATCH` | *Partially Implemented* (Route not mounted in Router) |
| **DELETE** | Not in Router | UI Attempts `DELETE` | *Partially Implemented* (Route not mounted in Router) |

---

### 7.2 CREATE PROVIDER (`POST /v1/model-provider/providers`)

- **HTTP Method:** `POST`
- **Route:** `/v1/model-provider/providers`
- **Controller:** `ProviderController.createProvider` (`apps/model-provider-service/src/controllers/provider.controller.ts`)
- **Database:** PostgreSQL table `providers`
- **Security Guardrail:** API keys and credentials are **NEVER** stored directly in the `providers` table. The `configurationReference` field holds the name of the environment variable (e.g., `GEMINI_API_KEY`). The `GeminiProviderAdapter` dynamically reads the secret from the server environment at execution time!

#### A. Request Body:
```json
{
  "name": "Google Gemini Enterprise",
  "type": "gemini",
  "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
  "status": "active",
  "healthStatus": "healthy",
  "priority": 1,
  "configurationReference": "GEMINI_API_KEY"
}
```

#### B. Response Body (`201 Created`):
```json
{
  "data": {
    "id": "e1f2a3b4-5678-90ab-cdef-1234567890ab",
    "name": "Google Gemini Enterprise",
    "type": "gemini",
    "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
    "status": "active",
    "healthStatus": "healthy",
    "priority": 1,
    "configurationReference": "GEMINI_API_KEY",
    "createdAt": "2026-10-12T10:25:00.000Z",
    "updatedAt": "2026-10-12T10:25:00.000Z"
  },
  "traceId": "c1c70eb3-4b8d-4e67-90ec-064c83179aff"
}
```

---

### 7.3 READ PROVIDERS (`GET /v1/model-provider/providers`)

- **HTTP Method:** `GET`
- **Route:** `/v1/model-provider/providers`
- **Controller:** `ProviderController.listProviders`
- **Database:** Executes `SELECT id, organization_id, name, type, base_url, status, health_status, priority, configuration_reference, created_at, updated_at FROM providers ORDER BY priority ASC, created_at DESC`

#### Response Body (`200 OK`):
```json
{
  "data": [
    {
      "id": "p1111111-1111-1111-1111-111111111111",
      "name": "Google Gemini",
      "type": "gemini",
      "baseUrl": "https://generativelanguage.googleapis.com/v1beta",
      "status": "active",
      "healthStatus": "healthy",
      "priority": 1,
      "configurationReference": "GEMINI_API_KEY",
      "createdAt": "2026-09-01T00:00:00.000Z",
      "updatedAt": "2026-09-01T00:00:00.000Z"
    }
  ],
  "traceId": "9b94970c-2905-4f41-a55b-fca1844afd7f"
}
```

---

## 8. Browser Network Tab Demonstration

Follow these exact steps when demonstrating live in Google Chrome, Microsoft Edge, or Firefox:

### Step-by-Step Demonstration Protocol:
1. Open dashboard at [http://localhost:5173](http://localhost:5173) (or production container at [http://localhost:80](http://localhost:80)).
2. Log in using `admin@aegisai.local` / `<configured in .env: SEED_ADMIN_PASSWORD>`.
3. Press **F12** to open Developer Tools.
4. Click the **Network** tab.
5. In the filter bar, select **Fetch/XHR**.
6. Check **Preserve log** (recommended).
7. Navigate to **AI Requests** → Click **New Request**.
8. Enter a prompt: `"Explain zero trust AI architecture."`
9. Click **Submit**.
10. In the Network tab list, click the top entry: `ai-requests`.

### What to Show in the DevTools Panel:
- **Headers Tab:**
  - `Request URL`: `http://localhost:5173/v1/ai-requests` (proxied to port 4000)
  - `Request Method`: `POST`
  - `Status Code`: `201 Created`
  - `Request Headers`: Show `Authorization: Bearer eyJhbGci...` and `Idempotency-Key: 1791...`
  - `Response Headers`: Show `x-correlation-id` and `ETag: W/"..."`
- **Payload Tab:**
  - Show JSON: `{"input": "Explain zero trust AI architecture."}`
- **Response Tab:**
  - Show status `COMPLETED`, the generated `output`, and metadata returned from Gemini.

---

## 9. Swagger / OpenAPI Demonstration

AegisAI natively serves Swagger UI directly from `apps/api` using the hand-written OpenAPI 3.0 specification (`openapi/openapi.yaml`).

- **Swagger URL:** [http://localhost:4000/docs](http://localhost:4000/docs)
- **Raw OpenAPI Schema:** [http://localhost:4000/openapi.json](http://localhost:4000/openapi.json)

### Demonstration Protocol:
1. Open [http://localhost:4000/docs](http://localhost:4000/docs) in a browser.
2. Scroll to the green **Authorize** button at the top right.
3. Obtain a token via `POST /v1/auth/login` and paste it into the `BearerAuth` modal.
4. Expand **AI Requests** → `POST /ai-requests` ("Submit an AI request").
5. Click **Try it out**.
6. In `Idempotency-Key` header, enter: `demo-swagger-key-01`.
7. In the request body, use:
```json
{
  "input": "Summarize enterprise security governance.",
  "modelPreference": "auto"
}
```
8. Click **Execute**.
9. Review:
   - **Request URL:** `http://localhost:4000/v1/ai-requests`
   - **Server Response Code:** `201`
   - **Response Body:** Real JSON envelope with `data` and `traceId`.

---

## 10. Automated cURL Demonstrations

You can execute these safe commands directly in PowerShell or Bash.

### Step 0: Obtain Access Token
```bash
TOKEN=$(curl -s -X POST "http://localhost:4000/v1/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"email\":\"$SEED_ADMIN_EMAIL\",\"password\":\"$SEED_ADMIN_PASSWORD\"}" \
  | node -e "let b='';process.stdin.on('data',d=>b+=d);process.stdin.on('end',()=>console.log(JSON.parse(b).data.token))")
```

### 1. Create AI Request (Success - 201)
```bash
curl -i -X POST "http://localhost:4000/v1/ai-requests" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -H "Idempotency-Key: curl-demo-001" \
  -d '{"input": "What is the purpose of an AI Gateway?", "modelPreference": "auto"}'
```

### 2. List AI Requests (Success - 200)
```bash
curl -i -X GET "http://localhost:4000/v1/ai-requests?limit=5" \
  -H "Authorization: Bearer $TOKEN"
```

### 3. Test Privacy Scanner Sandbox (Success - 200)
```bash
curl -i -X POST "http://localhost:4000/v1/privacy/scan" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"text": "Employee Jane Doe, email: jane.doe@company.com, phone: 9876543210"}'
```

### 4. List Models (Success - 200)
```bash
curl -i -X GET "http://localhost:4000/v1/model-provider/models" \
  -H "Authorization: Bearer $TOKEN"
```

### 5. List Providers (Success - 200)
```bash
curl -i -X GET "http://localhost:4000/v1/model-provider/providers" \
  -H "Authorization: Bearer $TOKEN"
```

---

## 11. Postman / REST Client Demonstration Table

| # | Operation | Method | Endpoint | Headers | Body | Expected Status |
|---|:---|:---|:---|:---|:---|:---:|
| 1 | Authenticate | `POST` | `/v1/auth/login` | `Content-Type: application/json` | `{"email":"admin@aegisai.local","password":"<your_SEED_ADMIN_PASSWORD>"}` | `200 OK` |
| 2 | Submit AI Request | `POST` | `/v1/ai-requests` | `Authorization: Bearer <TOKEN>`<br>`Idempotency-Key: postman-01` | `{"input":"Explain zero trust security"}` | `201 Created` |
| 3 | List AI Requests | `GET` | `/v1/ai-requests` | `Authorization: Bearer <TOKEN>` | *None* | `200 OK` |
| 4 | Get AI Request Detail | `GET` | `/v1/ai-requests/:id` | `Authorization: Bearer <TOKEN>` | *None* | `200 OK` |
| 5 | Conditional ETag Revalidation | `GET` | `/v1/ai-requests/:id` | `Authorization: Bearer <TOKEN>`<br>`If-None-Match: <ETAG>` | *None* | `304 Not Modified` |
| 6 | Privacy Scan Sandbox | `POST` | `/v1/privacy/scan` | `Authorization: Bearer <TOKEN>` | `{"text":"Secret: sk-test12345678901234"}` | `200 OK` |
| 7 | List Models | `GET` | `/v1/model-provider/models` | `Authorization: Bearer <TOKEN>` | *None* | `200 OK` |
| 8 | Register Model | `POST` | `/v1/model-provider/models` | `Authorization: Bearer <TOKEN>` | `{"providerId":"...","name":"gpt-4o",...}` | `201 Created` |
| 9 | List Providers | `GET` | `/v1/model-provider/providers` | `Authorization: Bearer <TOKEN>` | *None* | `200 OK` |
| 10 | Register Provider | `POST` | `/v1/model-provider/providers` | `Authorization: Bearer <TOKEN>` | `{"name":"Google","type":"gemini",...}` | `201 Created` |

---

## 12. Success and Error Status Codes Demonstration

| Status Code | Trigger Method | Endpoint & Parameters | Underlying Code Location |
| :---: | :--- | :--- | :--- |
| **`200 OK`** | Normal query | `GET /v1/ai-requests` | `AiRequestsController.list` |
| **`201 Created`** | Successful entity creation | `POST /v1/ai-requests` | `AiRequestsController.submit` |
| **`304 Not Modified`** | Send matching `If-None-Match: <ETag>` | `GET /v1/ai-requests/:id` | `apps/gateway-service/src/middleware/etag.ts` |
| **`400 Bad Request`** | Omit `Idempotency-Key` header | `POST /v1/ai-requests` | `apps/gateway-service/src/middleware/idempotency.ts` |
| **`401 Unauthorized`**| Omit or send corrupted JWT | `GET /v1/ai-requests` | `apps/identity-service/src/middleware/authenticateJWT.ts` |
| **`403 Forbidden`** | Send text containing secret API key | `POST /v1/ai-requests` | `AiRequestsService.submit` (`POLICY_BLOCK`) |
| **`404 Not Found`** | Query non-existent random UUID | `GET /v1/ai-requests/00000000-0000-0000-0000-000000000000` | `AiRequestsService.findScoped` |
| **`409 Conflict`** | Send concurrent request with same key | `POST /v1/ai-requests` | `apps/gateway-service/src/middleware/idempotency.ts` |
| **`429 Too Many Req`**| Flood endpoint beyond window limit | `POST /v1/ai-requests` | `apps/gateway-service/src/middleware/rate-limit.ts` |
| **`502 Bad Gateway`** | Force provider outage / timeout | Downstream adapter failure | `AiRequestsService.submit` (`PROVIDER_FAILURE`) |

---

## 13. Professor's 28 Requirements Relevant to This Demo

| # | Requirement | Demonstrated Through | How to Visibly Show to Professor |
|---|:---|:---|:---|
| **1** | HTTP Methods | AI Requests, Models, Providers | Show `GET`, `POST` in DevTools Network tab. |
| **2** | Idempotency Key | `POST /v1/ai-requests` | Show `Idempotency-Key` header in Network tab & Redis cache behavior. |
| **3** | AJV JSON Schema Validation | `POST /v1/ai-requests` | Show rejection of empty/malformed body with AJV error object details. |
| **4** | Versioning under `/v1` | Global API Architecture | Show all endpoints prefixed with `/v1/` across Swagger and Network tab. |
| **5** | At least 8 HTTP Status Codes | AI Requests Gateway | Demonstrate 200, 201, 304, 400, 401, 403, 404, 409, 429 live. |
| **6** | ETag & 304 Not Modified | `GET /v1/ai-requests/:id` | Show `ETag: W/"..."` in response headers and test with `If-None-Match`. |
| **7** | Content Negotiation (JSON/XML) | Global API Middleware | Send `Accept: application/xml` to get XML formatted response `<response><data>...`. |
| **8** | Cursor Pagination | `GET /v1/ai-requests` | Show `?limit=20&cursor=...` query params and `meta.nextCursor` output. |
| **9** | Consistent Error Envelope | Error Handler Middleware | Show standardized `{ error: { code, message, details, traceId } }`. |
| **10**| Cache-Control Headers | AI Requests Router | Show `private, no-cache` on list and `private, max-age=30` on single GET. |
| **11**| Resource-Shaped URLs | REST Routing | Show clean nouns (`/v1/ai-requests`, `/v1/models`, `/v1/providers`). |
| **12**| Rate Limiting & 429 | Redis Limiter | Show `X-RateLimit-Limit`, `X-RateLimit-Remaining` headers in response. |
| **13**| OpenAPI Specification | Swagger / Docs | Show `openapi/openapi.yaml` and live `/docs` endpoint. |
| **16**| SQL Database | PostgreSQL 16 | Inspect tables `ai_requests`, `models`, `providers` in PostgreSQL container. |
| **20**| Outbound Timeout | Gemini Provider Adapter | Show 30-second timeout enforcement on outbound provider calls. |
| **21**| Express Middleware | Pipeline Stack | Inspect middleware chain: correlation ID, rate limit, idempotency, auth. |
| **22**| NoSQL Database | MongoDB 7 | Inspect persistent PII scan results in MongoDB collection `scanner_results`. |
| **26**| Correlation ID & Logging | Pino Logger | Show `x-correlation-id` in response headers matched in terminal server logs. |
| **27**| JWT Auth & RBAC | Identity Service | Show `Authorization: Bearer` token claims (`sub`, `organizationId`, `role`). |

---

## 14. Source-Code / File Evidence Matrix

When your professor asks *"Where in the codebase did you write this?"*, immediately navigate to these exact files:

| Feature | Method | Exact Endpoint | Frontend Component | Backend Route File | Controller / Service | Database Table / Store |
| :--- | :---: | :--- | :--- | :--- | :--- | :--- |
| **AI Request (Submit)** | `POST` | `/v1/ai-requests` | `apps/frontend/src/pages/NewAiRequestPage.tsx` | `apps/gateway-service/src/routes/ai-requests.routes.ts` | `AiRequestsController.submit`<br>`AiRequestsService.submit` | PostgreSQL: `ai_requests` |
| **AI Request (List)** | `GET` | `/v1/ai-requests` | `apps/frontend/src/pages/AiRequestsPage.tsx` | `apps/gateway-service/src/routes/ai-requests.routes.ts` | `AiRequestsController.list`<br>`PgAiRequestsRepository.listByOrganization` | PostgreSQL: `ai_requests` |
| **AI Request (Detail)** | `GET` | `/v1/ai-requests/:id` | `apps/frontend/src/pages/AiRequestDetailPage.tsx` | `apps/gateway-service/src/routes/ai-requests.routes.ts` | `AiRequestsController.getById`<br>`AiRequestsService.getById` | PostgreSQL: `ai_requests` |
| **Privacy Sandbox** | `POST` | `/v1/privacy/scan` | `apps/frontend/src/pages/PrivacyScannerPage.tsx` | `apps/privacy-service/src/routes/scan.routes.ts` | `scan.controller.ts`<br>`PrivacyScanner.scan` | In-memory execution (Zero retention) |
| **Privacy Pipeline** | Internal | Internal Service Call | Embedded in Gateway Flow | `apps/privacy-service/src/services/privacy-scan.service.ts` | `PrivacyScanService.scanAndRecord` | MongoDB: `scanner_results` |
| **List Models** | `GET` | `/v1/model-provider/models` | `apps/frontend/src/pages/ModelsProvidersPage.tsx` | `apps/model-provider-service/src/routes/model.routes.ts` | `ModelController.listModels`<br>`PgModelRepository.listAll` | PostgreSQL: `models` |
| **Create Model** | `POST` | `/v1/model-provider/models` | `apps/frontend/src/pages/ModelsProvidersPage.tsx` | `apps/model-provider-service/src/routes/model.routes.ts` | `ModelController.createModel`<br>`PgModelRepository.create` | PostgreSQL: `models` |
| **List Providers** | `GET` | `/v1/model-provider/providers` | `apps/frontend/src/pages/ModelsProvidersPage.tsx` | `apps/model-provider-service/src/routes/provider.routes.ts` | `ProviderController.listProviders`<br>`PgProviderRepository.listAll` | PostgreSQL: `providers` |
| **Create Provider** | `POST` | `/v1/model-provider/providers` | `apps/frontend/src/pages/ModelsProvidersPage.tsx` | `apps/model-provider-service/src/routes/provider.routes.ts` | `ProviderController.createProvider`<br>`PgProviderRepository.create` | PostgreSQL: `providers` |
| **Gemini Adapter** | Outbound | Google API Endpoint | Background Outbound Proxy | `apps/model-provider-service/src/services/adapters/gemini.provider.ts` | `GeminiProviderAdapter.generate` | External: Google Gemini API |

---

## 15. Complete Request Flow Diagram

```mermaid
flowchart TD
    Client[Client / Browser] -->|1. POST /v1/ai-requests| GW[Express API Gateway]
    GW -->|2. Verify JWT| Auth[Identity & Access Management]
    GW -->|3. Check Rate Limit & Idempotency| Redis[(Redis Store)]
    GW -->|4. AJV Schema Validation| Schema[createAiRequestSchema]
    GW -->|5. Insert 'RECEIVED'| PG1[(PostgreSQL: ai_requests)]
    
    GW -->|6. Execute Scan| Priv[Privacy Scanner Service]
    Priv -->|7. Regex & Keyword Matching| Detectors[Detect PII / Secrets]
    Priv -->|8. Record Scan Result| Mongo[(MongoDB: scanner_results)]
    
    GW -->|9. Evaluate Rules| Policy[Policy Evaluation Service]
    Policy -->|Action Check| Decision{Policy Action?}
    
    Decision -->|BLOCK| Block[Throw 403 Forbidden]
    Decision -->|REQUIRE_APPROVAL| Approval[Pause Pipeline -> APPROVAL_REQUIRED]
    Decision -->|ALLOW / MASK| Route[Model & Provider Router]
    
    Route -->|10. Mask Text if needed| Redact[PrivacyScanner.redact]
    Route -->|11. Select Active Model| ModelDB[(PostgreSQL: models)]
    Route -->|12. Select Provider Adapter| GeminiAdapter[GeminiProviderAdapter]
    
    GeminiAdapter -->|13. HTTPS POST with x-goog-api-key| Google[Google Gemini 3.8 Flash API]
    Google -->|14. Model Output| GeminiAdapter
    
    GeminiAdapter -->|15. Update 'COMPLETED'| PG2[(PostgreSQL: ai_requests)]
    GW -->|16. Log Event with Trace ID| Audit[(PostgreSQL: audit_events)]
    GW -->|17. Return 201 Created| Client
```

---

## 16. The 10-Minute Professor Demonstration Sequence

| Minute | Step | Action to Perform | What to Show on Screen |
| :---: | :--- | :--- | :--- |
| **00:00 - 01:00** | **Step 1: System Overview** | Open [http://localhost:5173](http://localhost:5173). Log in as `admin@aegisai.local`. | Dashboard Overview screen, topbar organization tag, user badge. |
| **01:00 - 03:00** | **Step 2: AI Request Flow** | Open **F12 Network Tab** (Filter: `Fetch/XHR`). Go to **AI Requests** → **New Request**. Enter prompt: `"Provide 3 security recommendations for REST APIs."` Click **Submit**. | Point to `POST /v1/ai-requests`. Show `201 Created`. Show `Idempotency-Key` header, JSON request payload, and the LLM completion response. |
| **03:00 - 04:30** | **Step 3: Privacy Scanner** | Navigate to **Privacy Scanner Sandbox**. Enter text with PII: `"Contact Alice at alice@corp.com, phone 9876543210, PAN ABCDE1234F"`. Click **Scan Text**. | Point to `POST /v1/privacy/scan`. Show `200 OK`. Show the 3 detected entities (EMAIL, PHONE, PAN), confidence scores, and instant redacted output `[REDACTED_...]`. |
| **04:30 - 06:00** | **Step 4: Infrastructure CRUD** | Navigate to **Models & Providers**. View the registered models (`gemini-3.8-flash`). Click **New Model**. Fill in model name, capabilities, and sensitivity. Save. | Point to `POST /v1/model-provider/models`. Show `201 Created` in Network tab and new row appearing immediately in the table. |
| **06:00 - 07:30** | **Step 5: Swagger / OpenAPI** | Open a new tab to [http://localhost:4000/docs](http://localhost:4000/docs). | Show Swagger UI rendered from `openapi/openapi.yaml`. Run `GET /v1/ai-requests` directly from Swagger. |
| **07:30 - 08:30** | **Step 6: Status Code Demo** | In terminal, send request with missing idempotency key or bad auth token. | Show clean `400 Bad Request` or `401 Unauthorized` adhering to standard error envelope. |
| **08:30 - 10:00** | **Step 7: Code Evidence** | Open code in editor (or point to paths in this guide). | Show `apps/gateway-service/src/services/ai-requests.service.ts` and `apps/model-provider-service/src/services/adapters/gemini.provider.ts`. |

---

## 17. Simple Speaking Scripts for Your Demonstration

### Script 1: Demonstrating AI Requests
> *"Professor, I am now submitting an AI request from the dashboard. When I click Submit, the React frontend issues an authenticated HTTP `POST` request to `/v1/ai-requests`. Notice in the Network tab that we include an `Idempotency-Key` header and Bearer token. On the backend, the request passes through our rate limiter, idempotency cache in Redis, and AJV schema validator. The Gateway service persists an initial state in PostgreSQL, scans the text for sensitive entities, evaluates organizational policy, routes the request to our active Gemini model adapter, and returns a `201 Created` status with the LLM completion and a correlated trace ID."*

### Script 2: Demonstrating the Privacy Scanner
> *"Here in the Privacy Scanner sandbox, we can test deterministic entity detection. When I submit this text containing an email, phone number, and PAN card number, the frontend calls `POST /v1/privacy/scan`. Notice that our service immediately detects all three entities, assigns confidence ratings, suggests appropriate governance actions, and generates a sanitized version using back-to-front token replacement. Crucially, this sandbox endpoint is zero-retention to prevent storing raw secrets in persistent storage."*

### Script 3: Demonstrating Models & Providers
> *"On the Infrastructure page, AegisAI maintains a decoupled model and provider catalog. When the page loads, it executes `GET /v1/model-provider/models` and `GET /v1/model-provider/providers`. When registering a provider, we never store raw API keys in the database table; instead, we store an environment configuration reference like `GEMINI_API_KEY`. The provider adapter resolves the secret securely on the server side when invoking Google Gemini over HTTPS."*

### Script 4: Demonstrating Swagger & OpenAPI
> *"We also provide a fully compliant OpenAPI 3.0 document hosted directly by the API Gateway at `/docs`. Every endpoint, request schema, parameter, and error envelope demonstrated in the frontend can be inspected and executed independently through this interactive Swagger UI."*

---

## 18. Professor Viva Questions & Verified Answers

#### Q1: "Why do you return `201 Created` instead of `200 OK` for `POST /v1/ai-requests`?"
> **Answer:** *"Because `POST /v1/ai-requests` creates a persistent resource entity in our PostgreSQL database with its own lifecycle state, timestamps, and UUID identifier (`id`). According to HTTP/1.1 RFC 9110, whenever a POST operation results in the creation of a new persistent resource, `201 Created` is the semantically correct status code."*

#### Q2: "How does your system prevent duplicate LLM calls if a client network connection drops and retries?"
> **Answer:** *"We enforce idempotency using Redis in `idempotencyMiddleware`. Clients must supply an `Idempotency-Key` header. When a request arrives, we store `idempotency:<orgId>:<key>` in Redis with status `processing`. If a second identical request arrives while the first is executing, it is rejected with `409 Conflict`. Once the initial call completes, the 201 response payload is cached in Redis for 24 hours. Any subsequent retry with that same key immediately returns the cached result without re-invoking Gemini."*

#### Q3: "How is the Google Gemini API key protected from being exposed to clients?"
> **Answer:** *"The frontend never has access to the API key. In our database `providers` table, we only store `configurationReference = 'GEMINI_API_KEY'`. When the request is routed on the server, `GeminiProviderAdapter` reads `process.env.GEMINI_API_KEY` in Node.js and injects it strictly into the outbound `x-goog-api-key` HTTP header sent to Google's API. The key is never returned in REST responses or stored in database tables."*

#### Q4: "Where is the Privacy Scanner data stored?"
> **Answer:** *"For real AI requests processed through the gateway pipeline, the scan results and detected finding types are stored in MongoDB (`scanner_results` collection), decoupled from the PostgreSQL relational tables. For the sandbox testing endpoint (`POST /v1/privacy/scan`), results are strictly in-memory and transient, ensuring that arbitrary user-submitted secrets are never persisted."*

#### Q5: "How does your ETag caching work?"
> **Answer:** *"Our `etagMiddleware` calculates an MD5 hash of the response payload and sends it as a weak ETag header (`W/"<hash>"`). On subsequent GET requests for that resource, the browser sends `If-None-Match: W/"<hash>"`. If the content has not changed, the server immediately returns `304 Not Modified` with an empty response body, saving network bandwidth."*

---

## 19. Quick Revision Summary Table

| Category | Value / Path |
| :--- | :--- |
| **Frontend Web URL** | [http://localhost:5173](http://localhost:5173) (Vite Dev) / [http://localhost:80](http://localhost:80) (Docker Nginx) |
| **Backend API Gateway** | [http://localhost:4000](http://localhost:4000) |
| **Swagger UI Documentation** | [http://localhost:4000/docs](http://localhost:4000/docs) |
| **OpenAPI 3.0 Schema** | [http://localhost:4000/openapi.json](http://localhost:4000/openapi.json) |
| **Legacy SOAP Mock Service** | [http://localhost:5005](http://localhost:5005) |
| **Demo Admin Email** | `admin@aegisai.local` (configurable via `SEED_ADMIN_EMAIL`) |
| **Demo Admin Password** | Configured in local `.env` as `SEED_ADMIN_PASSWORD` |
| **Primary Relational DB** | PostgreSQL 16 (Port 5433 host, container `aegisai-postgres`) |
| **Document Store (Scanner)** | MongoDB 7 (Port 27017, container `aegisai-mongo`) |
| **Cache & Rate Limiting** | Redis 7 (Port 6379, container `aegisai-redis`) |
| **Active Default LLM** | `gemini-3.8-flash` (via Google Generative Language API) |
