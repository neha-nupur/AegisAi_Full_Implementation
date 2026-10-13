import { DEFAULT_ACTION_BY_TYPE, type Finding, type ScanResult } from "./finding-types";
import { loadSensitiveKeywords, runKeywordDetector, runStructuralDetectors, type DetectorMatch } from "./detectors";

/**
 * Deterministic PII/secret/sensitive-keyword scanner (Phase 4).
 *
 * `scan()` returns exactly the shape the Phase 4 instructions
 * specified: `{ detected, findings: [{ type, location, confidence,
 * action }] }`. Deliberately does **not** include the matched
 * substring anywhere in this result — "never store raw secrets"
 * (Phase 4 instructions) is enforced at the source, not just at the
 * persistence layer, so a caller can't accidentally log or persist
 * a raw secret even if it wanted to. `redact()` is the only place
 * that ever touches the original matched text, and it returns a
 * masked string, never the match itself.
 */
export class PrivacyScanner {
  constructor(private readonly sensitiveKeywords: string[] = loadSensitiveKeywords()) {}

  scan(text: string, field = "input"): ScanResult {
    const raw = [...runStructuralDetectors(text), ...runKeywordDetector(text, this.sensitiveKeywords)];
    const resolved = resolveOverlaps(raw);

    const findings: Finding[] = resolved
      .sort((a, b) => a.start - b.start)
      .map((match) => ({
        type: match.type,
        location: { field, start: match.start, end: match.end },
        confidence: match.confidence,
        action: DEFAULT_ACTION_BY_TYPE[match.type],
      }));

    return { detected: findings.length > 0, findings };
  }

  /**
   * Replaces every finding's span with a type-tagged placeholder
   * (e.g. `[REDACTED_EMAIL]`). Applied back-to-front by offset so
   * earlier offsets stay valid as later spans are replaced.
   */
  redact(text: string, findings: Finding[]): string {
    let result = text;
    const bySpanDesc = [...findings].sort((a, b) => b.location.start - a.location.start);
    for (const finding of bySpanDesc) {
      const placeholder = `[REDACTED_${finding.type}]`;
      result = result.slice(0, finding.location.start) + placeholder + result.slice(finding.location.end);
    }
    return result;
  }
}

/**
 * Structural detectors don't overlap with each other by construction
 * (different character classes/lengths), but the keyword detector can
 * overlap with a structural match (e.g. the word "confidential" next
 * to an email). When two matches overlap, keep the higher-confidence
 * one and drop the other — a span should only ever produce one finding.
 */
function resolveOverlaps(matches: (DetectorMatch & { confidence: number })[]): (DetectorMatch & { confidence: number })[] {
  const sorted = [...matches].sort((a, b) => b.confidence - a.confidence || a.start - b.start);
  const kept: (DetectorMatch & { confidence: number })[] = [];
  for (const match of sorted) {
    const overlaps = kept.some((k) => match.start < k.end && k.start < match.end);
    if (!overlaps) kept.push(match);
  }
  return kept;
}
