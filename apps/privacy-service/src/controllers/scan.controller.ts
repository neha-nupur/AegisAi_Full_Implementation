import { Request, Response, NextFunction } from "express";
import { PrivacyScanner } from "../domain/scanner";

const scanner = new PrivacyScanner();

/**
 * POST /v1/privacy/scan
 *
 * Sandbox endpoint: runs the real PrivacyScanner on arbitrary text
 * submitted by the frontend. Returns detected findings and a masked
 * version of the input.
 *
 * Decision: sandbox results are intentionally NOT persisted. Storing
 * arbitrary user-submitted PII/secrets in scanner_results would
 * contradict the "never store raw secrets" principle. The AI-gateway
 * pipeline persists scanner results linked to real ai_requests; this
 * endpoint is a demo-only surface.
 */
export async function scanSandbox(req: Request, res: Response, next: NextFunction) {
  try {
    const text = req.body?.text;
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({
        error: {
          code: "VALIDATION_ERROR",
          message: "Field 'text' is required and must be a non-empty string.",
        }
      });
    }

    const result = scanner.scan(text);
    const maskedText = result.detected ? scanner.redact(text, result.findings) : text;

    return res.json({
      data: {
        detected: result.detected,
        findingCount: result.findings.length,
        findingTypes: [...new Set(result.findings.map((f) => f.type))],
        findings: result.findings,
        maskedText,
      }
    }) as any;
  } catch (error) {
    next(error);
  }
}
