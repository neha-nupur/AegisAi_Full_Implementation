# Model & Provider Management Service

Package: `@aegisai/model-provider-service`

Owns: **providers, models, routing metadata**

## Phase 1 status

- Layered structure in place: `routes -> controllers -> services -> repositories`.
- `GET /health` implemented end-to-end through that layering.
- `repositories/`, `schemas/`, `middleware/`, `types/` are reserved
  (see each folder's own README/placeholder) — no domain logic yet.
- Exposes `modelProviderRouter`, mounted by `apps/api` under
  `/v1/model-provider` (modular monolith; see CLAUDE.md section 14).
- Implements the health portion of `ModelProviderServiceContract` from
  `@aegisai/shared-types`. Domain methods on that contract, and this
  service's own persistence, arrive starting Phase 5.

See `/docs/service-boundaries.md` for responsibilities, inputs,
outputs, dependencies, and communication direction.
