/**
 * Privacy Scanner Service
 *
 * Owns: scanner_results, scanner findings
 *
 * Phase 4: deterministic PII/secret/sensitive-keyword detection
 * (`PrivacyScanner`), masking/redaction, and MongoDB-backed
 * `scanner_results` persistence. No public HTTP surface of its own
 * yet beyond `GET /v1/privacy/health` — this service is called
 * in-process by `AiRequestsService` (apps/gateway-service), the same
 * "contracts are called in-process" convention every service
 * contract in `@aegisai/shared-types` documents. A real HTTP/RPC
 * adapter, if this service is ever split out of the monolith, would
 * implement the same `PrivacyScanService` shape.
 */
export { SERVICE_NAME } from "./service-name";
export { privacyRouter } from "./routes";
export { PrivacyScanService } from "./services/privacy-scan.service";
export { PrivacyScanner } from "./domain/scanner";
export { MongoScannerResultsRepository, type ScannerResultsRepository } from "./repositories/scanner-results.repository";
export { FINDING_TYPES, SUGGESTED_ACTIONS, type FindingType, type SuggestedAction, type Finding, type ScanResult } from "./domain/finding-types";
export { closeMongoConnection } from "./db/mongo";
