/**
 * Background worker process.
 *
 * Phase 0 placeholder. Will host BullMQ-based async jobs (audit
 * persistence, provider retries, etc.) starting whichever phase
 * first needs asynchronous processing (Phase 6+), per CLAUDE.md's
 * "do not introduce dependencies without justification" rule —
 * BullMQ is not installed until a concrete job needs it.
 */
export const WORKER_PLACEHOLDER = true;
