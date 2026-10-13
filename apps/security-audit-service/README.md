# Security, Audit & Observability Service

Package: `@aegisai/security-audit-service`

Owns: **request_traces, security_events, audit_events**

## Phase 1 status

- Layered structure in place: `routes -> controllers -> services -> repositories`.
- `GET /health` implemented end-to-end through that layering.
- `repositories/`, `schemas/`, `middleware/`, `types/` are reserved
  (see each folder's own README/placeholder) — no domain logic yet.
- Exposes `securityAuditRouter`, mounted by `apps/api` under
  `/v1/security-audit` (modular monolith; see CLAUDE.md section 14).
- Implements the health portion of `SecurityAuditServiceContract` from
  `@aegisai/shared-types`. Domain methods on that contract, and this
  service's own persistence, arrive starting Phase 8.

See `/docs/service-boundaries.md` for responsibilities, inputs,
outputs, dependencies, and communication direction.
