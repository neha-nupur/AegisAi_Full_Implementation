import type { FindingType } from "./finding-types";

/** A single detector's raw match, before it is turned into a `Finding` (confidence/action added by `scanner.ts`). */
export interface DetectorMatch {
  type: FindingType;
  start: number;
  end: number;
}

interface Detector {
  type: FindingType;
  /** Base confidence for this detector's matches — deliberately not 1.0 for any pattern-based detector; these are heuristics, not verified identities. */
  confidence: number;
  pattern: RegExp;
}

/**
 * Deterministic, regex-based detectors (Phase 4 — "deterministic
 * detection", not ML-based). Every pattern is intentionally
 * conservative (word-boundary anchored) to keep false positives low
 * enough for a BLOCK/REQUIRE_APPROVAL action to be defensible.
 *
 * Ordering matters only for `SENSITIVE_KEYWORDS` (built separately,
 * see `buildSensitiveKeywordDetector`) — the structural detectors
 * below don't overlap by construction (different lengths/character
 * classes), so match order between them is not significant.
 */
export const STRUCTURAL_DETECTORS: Detector[] = [
  {
    type: "EMAIL",
    confidence: 0.95,
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
  },
  {
    // Indian 10-digit mobile numbers, optionally prefixed with +91 or 0.
    // \b on a run of digits only breaks where a non-digit sits, so this
    // will not fire on a 10-digit substring embedded in a longer
    // (e.g. 12-digit Aadhaar) digit run.
    type: "PHONE",
    confidence: 0.85,
    pattern: /(?:\+?91[-\s]?)?\b[6-9]\d{9}\b/g,
  },
  {
    // Indian PAN: 5 letters, 4 digits, 1 letter (e.g. ABCDE1234F).
    type: "PAN",
    confidence: 0.9,
    pattern: /\b[A-Za-z]{5}[0-9]{4}[A-Za-z]\b/g,
  },
  {
    // Aadhaar-like: 12 digits, optionally grouped in 4s with a space or hyphen.
    type: "AADHAAR",
    confidence: 0.75,
    pattern: /\b\d{4}[\s-]?\d{4}[\s-]?\d{4}\b/g,
  },
  {
    // Common cloud/API key prefixes (AWS access keys, OpenAI/Stripe-style
    // "sk-"/"pk-" keys, generic "Bearer <token>" headers pasted into a
    // prompt) plus a generic long-random-token fallback.
    type: "API_KEY",
    confidence: 0.9,
    pattern: /\bAKIA[0-9A-Z]{16}\b|\b(?:sk|pk|rk)-[A-Za-z0-9]{16,}\b|\bBearer\s+[A-Za-z0-9._-]{20,}\b/g,
  },
  {
    // "password: ...", "pwd=...", "secret: ..." style credential dumps.
    type: "PASSWORD",
    confidence: 0.8,
    pattern: /\b(?:password|passwd|pwd|secret)\s*[:=]\s*\S+/gi,
  },
];

export function runStructuralDetectors(text: string): (DetectorMatch & { confidence: number })[] {
  const matches: (DetectorMatch & { confidence: number })[] = [];
  for (const detector of STRUCTURAL_DETECTORS) {
    // A fresh RegExp per call — the module-level pattern carries `lastIndex`
    // state across calls otherwise, corrupting matches on the next scan.
    const pattern = new RegExp(detector.pattern.source, detector.pattern.flags);
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(text)) !== null) {
      matches.push({ type: detector.type, start: match.index, end: match.index + match[0].length, confidence: detector.confidence });
      if (match[0].length === 0) pattern.lastIndex += 1; // guard against zero-width matches
    }
  }
  return matches;
}

/**
 * Configurable sensitive-keyword list. Kept as a plain exported array
 * (this service's own concern) rather than added to
 * `@aegisai/config`'s required-env contract, so extending the list
 * never forces every other service to redeploy with a new required
 * environment variable. Override via the optional `SENSITIVE_KEYWORDS`
 * env var (comma-separated) at this service's own call site — see
 * `buildSensitiveKeywordDetector`.
 */
export const DEFAULT_SENSITIVE_KEYWORDS = [
  "confidential",
  "internal only",
  "do not distribute",
  "trade secret",
  "layoff plan",
  "merger",
  "acquisition",
  "unannounced",
];

export function loadSensitiveKeywords(): string[] {
  const fromEnv = process.env.SENSITIVE_KEYWORDS;
  if (!fromEnv || fromEnv.trim() === "") return DEFAULT_SENSITIVE_KEYWORDS;
  return fromEnv
    .split(",")
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length > 0);
}

export function runKeywordDetector(text: string, keywords: string[]): (DetectorMatch & { confidence: number })[] {
  const matches: (DetectorMatch & { confidence: number })[] = [];
  const lowerText = text.toLowerCase();
  for (const keyword of keywords) {
    const lowerKeyword = keyword.toLowerCase();
    let fromIndex = 0;
    let idx: number;
    while ((idx = lowerText.indexOf(lowerKeyword, fromIndex)) !== -1) {
      matches.push({ type: "SENSITIVE_KEYWORD", start: idx, end: idx + keyword.length, confidence: 0.6 });
      fromIndex = idx + keyword.length;
    }
  }
  return matches;
}
