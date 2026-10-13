# Identity & Access Management Service — schemas

Phase 2 status: still a placeholder. Request validation in Phase 2
(login body, user/service-account/organization create & update
bodies) is done with small manual checks in each service method
(`services/*.service.ts`) rather than AJV — AJV-based JSON Schema
validation is introduced project-wide starting Phase 3 (see
`docs/checklist-mapping.md`, item 3), at which point this folder gets
real schemas for these same request bodies.
