# AegisAI — Complete Operator Guide

> This guide documents the **current, live implementation** of AegisAI, reflecting all recent feature additions including fully working authentication, email delivery, RBAC, GraphQL, and the modular monolith services.

---

## Quick Reference

| Component | URL | Purpose |
|---|---|---|
| **Frontend** | http://localhost:5173 | AegisAI Control Plane (React/Vite) |
| **API** | http://localhost:4000 | Backend REST / Gateway (Express) |
| **Swagger** | http://localhost:4000/docs | Interactive API Documentation |
| **GraphQL** | http://localhost:4000/v1/graphql | Apollo Server for Dashboard data |
| **SOAP Mock** | http://localhost:5005 | Legacy employee lookup mock |
| **Mail** | Ethereal Mail URL | Check terminal output when emails are sent |

---

## 1. System Startup

AegisAI runs as a **modular monolith** — six logical services contained within a single Express process — backed by PostgreSQL, MongoDB, and Redis.

### Starting the System
To start the entire environment locally:
```bash
docker compose -f docker/docker-compose.yml up -d postgres mongo redis soap-mock
npm run db:migrate:identity -w apps/identity-service
npm run dev -w apps/api       # Terminal 1: Starts the API
npm run dev -w apps/frontend  # Terminal 2: Starts the UI
```

### Verify Health
```bash
curl http://localhost:4000/health
# Expected: {"status":"ok"}
```

---

## 2. Authentication & The Complete User Journey

AegisAI uses JWT-based authentication. 

### The User Journey
1. **Landing Page:** A new visitor opens the application.
2. **Sign Up:** The user clicks "Sign Up", entering their name, email, organization name, and password. 
3. **Registration Email:** The system creates the account and dispatches a professional HTML welcome/registration email (delivered via Ethereal Mail in dev, or real SMTP in production).
   - *Note: Email verification is currently non-blocking. Users can log in immediately even if they haven't verified their email.*
4. **Login:** The user logs in with their credentials at the Sign In page.
5. **Dashboard:** The user enters the main AegisAI control plane.
6. **Logout:** The user clicks their profile in the top right and selects Logout, which clears their session token.

### Forgot Password Flow
1. **Forgot Password:** A user clicks "Forgot Password?" on the login screen.
2. **Enter Email:** They submit their email.
3. **Reset Link:** An HTML reset password email is dispatched (via Ethereal/SMTP) containing a secure reset token.
4. **Set New Password:** The user follows the link to the Reset Password page, submits a new password.
5. **Login Again:** The user logs in with their new credentials.

---

## 3. Role-Specific Operator Guides

AegisAI enforces Role-Based Access Control (RBAC) at the middleware layer. 

### A. ORGANIZATION ADMIN
- **Purpose:** Full control over the organization's governance, identity, and settings.
- **Login:** Standard login.
- **Accessible Sections:** All sidebar sections (Overview, AI Requests, Privacy Scanner, Policies, Approvals, Models, Providers, Users, Service Accounts, Security Events, Audit Log, Request Traces, Legacy Integration, Settings).
- **Abilities:** Can create/edit/delete policies, manage users, edit settings, approve requests, and view all system data.
- **Forbidden:** Accessing data from other organizations (tenant isolation returns `404 Not Found`).

### B. DEVELOPER
- **Purpose:** Submit AI requests and test policies.
- **Login:** Standard login.
- **Accessible Sections:** Overview, AI Requests, Privacy Scanner, Request Traces, Policies, Approvals, Models, Providers, Users, Service Accounts, Settings.
- **Read-Only:** Can view Policies, Models, Providers, Users, Approvals, and Settings.
- **Service Accounts:** Can view and create service accounts.
- **Forbidden:** Cannot edit Users, Settings, or Policies. Cannot view Security Events or Audit Logs. Attempting to access forbidden pages returns `403 Forbidden` or hides elements.

### C. SECURITY AUDITOR
- **Purpose:** Monitor the system for compliance and investigate incidents.
- **Login:** Standard login.
- **Accessible Sections:** Overview, Security Events, Audit Log, Request Traces, AI Requests, Privacy Scanner, Policies, Approvals, Models, Providers, Users, Settings.
- **Read-Only:** Can view all request metadata, security trails, Users, and Settings.
- **Abilities:** Can view and decide (Approve/Reject) paused requests in Approvals.
- **Forbidden:** Cannot submit new AI requests, cannot create/edit policies, cannot manage users or settings. Actions are blocked with a `403 Forbidden`.

---

## 4. Dashboard

The Dashboard provides a real-time governance overview, aggregating data from multiple services.

### Widgets & Cards
- **Total Requests / Completed / Blocked / Failed:** Metrics representing the volume and status of outbound AI traffic. (Sourced via GraphQL).
- **Pending Approvals:** The number of requests paused and waiting for human review. (Sourced via REST).
- **Security Events:** The count of recent security incidents (e.g., policy violations). (Sourced via REST).
- **Recent AI Requests:** A table showing the latest outbound prompts.
- **Recent Security Events:** A table showing the latest security alerts.

### Data Verification
The dashboard seamlessly blends **REST** and **GraphQL** queries under the hood, both authenticated with the same JWT. To verify data freshness, click the "Refresh" button in the top right.

---

## 5. AI Requests (Complete Walkthrough)

This is the core functionality of AegisAI. Every outbound request passes through a 10-stage internal pipeline.

### The Lifecycle
1. **RECEIVED**: Request ingested.
2. **VALIDATED**: Schema and parameters validated.
3. **PRIVACY SCAN**: Regex engine detects PII.
4. **POLICY EVALUATION**: Organization rules decide the action.
5. **ROUTING**: Model is selected based on capabilities and sensitivity.
6. **PROVIDER CALL**: The outbound call is made (wrapped in a circuit breaker).
7. **COMPLETED** (or **FAILED** / **BLOCKED** / **APPROVAL_REQUIRED**).

### Submitting a Request
1. Navigate to **Gateway -> AI Requests**.
2. Click **New Request**.
3. Enter your prompt. (e.g., *"What is the capital of France?"*)
4. Choose a **Model Preference** (or select "Auto" for dynamic routing).
5. Submit.
6. The request details and the AI response will be displayed.
7. Click **View Trace** to see the exact microsecond timings of all 10 internal stages.

---

## 6. Privacy Scanner

The Privacy Scanner detects PII and secrets deterministically *before* they reach a policy or a provider.

### Walkthrough
1. Navigate to **Gateway -> Privacy Scanner**.
2. Enter a safe synthetic text: *"My test email is alice@example.com and my API key is sk-test-example-12345"*.
3. Click **Scan text**.
4. The system will highlight the findings (e.g., `EMAIL` and `API_KEY`) and show their severity.
5. In the actual AI Request pipeline, these findings are fed into the Policy Engine, which decides whether to `MASK` the email, or `BLOCK` the API key.

---

## 7. Policies

Policies are the governance rules for your organization. The first matching rule wins.

### Available Actions
- **ALLOW**: Request proceeds normally.
- **BLOCK**: Request is rejected immediately. Provider is never called.
- **MASK**: Detected PII is replaced with `[REDACTED]` tags. The sanitized text is sent to the provider.
- **REQUIRE_APPROVAL**: The request is paused and sent to the Approvals queue.
- **ROUTE**: Forces the request to a specific, compliant model.

### Walkthrough (Testing a BLOCK rule)
1. Go to **Governance -> Policies**.
2. Create a rule: If `API_KEY` detected -> `BLOCK`.
3. Go to **AI Requests** -> New Request.
4. Enter: *"Analyze this key: sk-test-12345"*.
5. Submit.
6. The request immediately turns red with status **BLOCKED**. The AI provider is never called, saving money and preventing a data leak.

---

## 8. Approvals (Human-in-the-loop)

1. Create a policy: If `SENSITIVE_KEYWORD` detected -> `REQUIRE_APPROVAL`.
2. A Developer submits a prompt containing the keyword.
3. The request status becomes **APPROVAL_REQUIRED**.
4. The Developer is blocked from seeing a response.
5. An Organization Admin navigates to **Governance -> Approvals**.
6. The Admin reviews the prompt.
7. **APPROVE**: The request resumes the pipeline, is sent to the provider, and completes.
8. **REJECT**: The request is permanently marked **BLOCKED**.

---

## 9. Models & Providers

- **Providers:** The actual API connection (e.g., Gemini, OpenAI, Mock).
- **Models:** The specific AI models offered by those providers.

AegisAI's routing engine automatically selects the appropriate model based on the request's complexity and sensitivity (e.g., routing highly sensitive prompts to a secure internal model, and general prompts to a public model).

---

## 10. Identity & Access (Users)

Organization Admins manage personnel here.
- View the active user roster.
- Organization isolation guarantees users only see their own organization's data.

---

## 11. Service Accounts

Service accounts allow automated systems (like CI/CD pipelines or internal backend servers) to authenticate with AegisAI using static tokens instead of user login credentials.
- *Note: Creation and token generation are managed by Admins via the UI. When a service account is created, the system securely generates and displays a static credential token.*

---

## 12. Security Events

The **Security Events** log provides an attack surface view.
- Events include: `POLICY_BLOCK`, `PII_DETECTED`, `RATE_LIMIT_EXCEEDED`.
- This is where an Auditor goes to see *what went wrong* or *who tried to bypass controls*.

---

## 13. Audit Log

The **Audit Log** provides a compliance view.
- Events include: `AI_REQUEST_SUBMITTED`, `POLICY_CREATED`, `USER_LOGIN`.
- Every action contains the exact timestamp, actor ID, and resource ID for total accountability.

---

## 14. Request Traces

Request Traces are the "X-ray" of the system.
1. Find any request in the AI Requests table.
2. Copy its **Trace ID**.
3. Go to **Security & Audit -> Request Traces**.
4. Search or find the trace.
5. The trace shows a strict, chronological timeline of every internal middleware, privacy scan, policy evaluation, and provider call, complete with microsecond durations.

---

## 15. Legacy Integration

AegisAI demonstrates enterprise interoperability by talking to legacy XML/SOAP systems.
- Navigate to **Integrations -> Legacy Integration**.
- Enter employee ID `E1001` and click Check Status.
- AegisAI parses a WSDL file, constructs a SOAP 1.1 XML envelope, sends it to a mock HR system, and returns the parsed JSON.
- Entering `TIMEOUT` demonstrates the strict 5-second outbound circuit breaker failing gracefully.

---

## 16. Settings

The **Settings** page allows Org Admins to toggle operational defaults.
- Options include Auto-masking preferences, default routing behaviors, and timeout limits.
- Stored securely in PostgreSQL under the `organization_settings` table.

---

## 17. Profile & Logout

Clicking your profile in the top-right reveals your role and the Logout button.
- **Logout** immediately destroys the client-side session.
- Protected routes immediately become inaccessible, redirecting you to the login screen.

---

## 18. Complete End-to-End Demo (New Visitor)

**STEP 1:** Open `http://localhost:5173`.
**STEP 2:** Click "Sign Up". Create a new account with a synthetic email.
**STEP 3:** Log in with those credentials.
**STEP 4:** View the Dashboard (metrics will be empty for a new org).
**STEP 5:** Go to **Policies**. Create a policy to `BLOCK` all `EMAIL` findings.
**STEP 6:** Go to **Privacy Scanner**. Type *"My email is test@test.com"* to verify the scanner works.
**STEP 7:** Go to **AI Requests**. Submit: *"Write a poem for test@test.com"*.
**STEP 8:** Observe the request is **BLOCKED**.
**STEP 9:** Click the Request to view details, then click **View Trace**.
**STEP 10:** In the Trace, observe `PRIVACY_SCAN_COMPLETED` followed immediately by `POLICY_EVALUATED` (Action: BLOCK).
**STEP 11:** Go to **Security Events** to see the generated `POLICY_BLOCK` alert.
**STEP 12:** Go to **Audit Log** to see the `AI_REQUEST_SUBMITTED` trail.
**STEP 13:** Open **Legacy Integration**. Look up `E1001`.
**STEP 14:** Logout.

---

## 19. Three Role Demo Flows

### Demo A — Organization Admin
1. Login -> Dashboard.
2. Go to **Users** (View roster).
3. Go to **Policies** (Create a MASK policy).
4. Go to **Settings** (Update a configuration toggle).
5. Go to **AI Requests** -> Submit prompt -> View Trace.
6. Logout.

### Demo B — Developer
1. Login -> Dashboard.
2. Go to **AI Requests** -> Submit prompt.
3. Try to navigate to `/settings` manually via URL -> Observe 403 Forbidden / Redirection.
4. Try to navigate to `/policies` -> Observe it is Read-Only.
5. Logout.

### Demo C — Security Auditor
1. Login -> Dashboard.
2. Go to **Security Events** -> Filter and inspect blocked requests.
3. Go to **Request Traces** -> Inspect a correlation ID.
4. Go to **AI Requests** -> Try to submit a new request -> Observe failure or missing button (Read-Only access).
5. Logout.

---

## 20. Troubleshooting Guide

| Symptom | Likely Cause | Where to Check | Resolution |
|---|---|---|---|
| Cannot login | Invalid credentials / missing DB | PostgreSQL `users` table | Verify email/password. Check if DB is seeded. |
| Dashboard is empty | Data belongs to old Org ID | MongoDB `request_traces` | Submit a new AI request to generate fresh data for the logged-in org. |
| AI Request BLOCKED | Policy Rule triggered | Trace -> `POLICY_EVALUATED` | Adjust policy if unintended. |
| AI Request FAILED | AI Provider is down/missing key | Trace -> `PROVIDER_CALLED` | Check `.env` for `GEMINI_API_KEY` or `OPENAI_API_KEY`. |
| APPROVAL_REQUIRED | Human review needed | Approvals page | Admin must click "Approve". |
| 503 Service Unavailable | Circuit Breaker OPEN | API Logs | Wait 30 seconds for cockatiel breaker to reset. |

---

## 21. Professor Demo / Presentation Mode

*This 5-minute script covers all grading requirements.*

1. **Login & Dashboard:** "AegisAI is an enterprise AI Security Gateway. We intercept AI traffic to enforce governance. The dashboard fuses GraphQL and REST data securely using JWT RBAC."
2. **Privacy & Policy (BLOCK):** "I will try to send an API key to the AI. AegisAI's deterministic regex privacy scanner catches it, the policy engine evaluates it, and blocks it before the AI provider is ever called, saving money and preventing a leak."
3. **Resilience & SOAP:** "If an AI provider goes down, our `cockatiel` circuit breaker prevents cascading failures. We use the same resilience patterns for our legacy SOAP XML integration."
4. **Audit & Trace:** "Every request gets a UUID correlation ID. I can open Request Traces to see microsecond-level timings of the entire distributed lifecycle, and Security Events to prove compliance to auditors."
5. **Multi-Tenancy:** "All data is strictly isolated by Organization ID at the PostgreSQL and MongoDB query layers."

---

## 22. Technical Architecture Explanation

**Frontend:** React Single Page Application built with Vite.
**API:** Express.js modular monolith housing six logical services.
**Databases:**
- **PostgreSQL:** Stores highly structured, relational data (Users, Organizations, Policies).
- **MongoDB:** Stores high-volume, schemaless event streams (Traces, Audit Logs, Security Events).
- **Redis:** Manages fast, ephemeral state (Rate limiting windows, Idempotency caching).

**The Six Logical Services:**
1. **Identity & Access:** JWT issuance, RBAC, User/Org management.
2. **AI Request Gateway:** Public API ingress, validation, idempotency, rate limits.
3. **Privacy Scanner:** Regex-based PII detection.
4. **Policy & Approval:** Rule engine and human-in-the-loop workflows.
5. **Model & Provider Management:** Routing logic and resilient API wrappers.
6. **Security, Audit & Observability:** Immutable event logging and correlation tracing.

---

## 23. Security Notes

**CRITICAL WARNINGS FOR OPERATORS:**
- **Never** paste real API keys into AI prompts during demos.
- **Never** use real Aadhaar, PAN, SSN, or Customer Data. Use synthetic data only.
- **Never** commit `.env` files containing secrets.
- **Never** expose JWTs or Database credentials in screenshots or documentation.

---

## 24. Current Feature Status Table

| Feature | Status | How Verified | Notes |
|---|---|---|---|
| JWT Auth & RBAC | LIVE VERIFIED | Tested manually | `ORGANIZATION_ADMIN`, `DEVELOPER`, `SECURITY_AUDITOR` working. |
| Email Delivery | LIVE VERIFIED | Checked Ethereal | Welcome and Password Reset HTML emails are dispatched. |
| Privacy Scanner | LIVE VERIFIED | Tested via UI Sandbox | Successfully detects PII. |
| Policy Engine | LIVE VERIFIED | Tested via AI Requests | correctly executes ALLOW, BLOCK, MASK, APPROVAL. |
| Approvals | LIVE VERIFIED | Tested manually | Admin can successfully resume paused requests. |
| Model Routing | LIVE VERIFIED | Tested via AI Requests | Routes to Gemini or Mock provider based on config. |
| GraphQL Dashboard | LIVE VERIFIED | Tested via UI | Successfully aggregates data on the Overview page. |
| Traces & Audit | LIVE VERIFIED | Tested via UI | MongoDB accurately tracks lifecycle stages. |
| Legacy SOAP XML | LIVE VERIFIED | Tested via UI | Correctly parses WSDL and fetches mock XML data. |
| Rate Limiting | IMPLEMENTED | Tested via API | Redis sliding window limits requests. |
| Circuit Breaker | IMPLEMENTED | Tested via Code | `cockatiel` handles fail-fast provider drops. |
| Docker Stack | IMPLEMENTED | Tested Locally | Compose file boots all 7 containers successfully. |
