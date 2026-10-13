# Security, Audit & Observability Service — repositories

Phase 1 placeholder. Repository classes own this service's direct
data access and are the *only* code in the project allowed to query
this service's tables/collections (see CLAUDE.md section 3 — no
service may reach into another service's database).

Entities this service will own: request_traces, security_events, audit_events.

Repository implementations arrive starting Phase 8, alongside the
schema/migration work and the domain services that use them. Nothing
here is speculated ahead of that.
