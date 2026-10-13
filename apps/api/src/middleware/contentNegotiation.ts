import type { NextFunction, Request, Response } from "express";
import { create } from "xmlbuilder2";

/**
 * XML/JSON content negotiation (Phase 10).
 *
 * Centralized rather than per-controller: every controller across
 * every service calls `res.json(body)` (the project's one consistent
 * response convention — see docs/api-conventions.md). This middleware
 * wraps `res.json` once, at the top of the middleware chain, so any
 * of those calls transparently honors `Accept: application/xml`
 * without every controller needing to know XML exists. The same
 * logical resource is represented in both formats — this serializes
 * whatever object the controller already builds, it never changes
 * what that object contains.
 *
 * Negotiation rule: XML is used only when the client's `Accept`
 * header names `application/xml` and does NOT also accept
 * `application/json` (or the wildcard "any type" media range) — i.e.
 * only when the client has unambiguously asked for XML specifically.
 * `Accept: application/json` (the default for virtually every HTTP
 * client, including one with no `Accept` header at all — Express,
 * `fetch`, and `curl` all default to accepting anything or
 * JSON-friendly wildcards) continues to receive JSON exactly as
 * before Phase 10; this is additive, not a behavior change for any
 * existing caller.
 */
export function contentNegotiationMiddleware(req: Request, res: Response, next: NextFunction): void {
  const originalJson = res.json.bind(res);

  res.json = ((body: unknown) => {
    if (wantsXmlOnly(req.headers.accept)) {
      const xml = toXml(body);
      res.setHeader("Content-Type", "application/xml; charset=utf-8");
      res.send(xml);
      return res;
    }
    return originalJson(body);
  }) as Response["json"];

  next();
}

function wantsXmlOnly(acceptHeader: string | undefined): boolean {
  if (!acceptHeader) return false;
  const accept = acceptHeader.toLowerCase();
  if (accept.includes("application/json") || accept.includes("*/*")) return false;
  return accept.includes("application/xml") || accept.includes("text/xml");
}

/**
 * Wraps the response body under a single `<response>` root element
 * (XML requires exactly one root; the JSON envelope is an object, so
 * this never loses information — it's the same object, just with an
 * explicit root name XML needs and JSON doesn't).
 */
function toXml(body: unknown): string {
  return create({ response: toXmlSafe(body) }).end({ prettyPrint: true });
}

/**
 * xmlbuilder2 requires object keys to be valid XML element names and
 * cannot directly represent a bare array at the top level of a
 * property — this recursively reshapes arrays into a repeated
 * `<item>` element (the conventional way to represent a JSON array in
 * XML) and leaves everything else structurally identical.
 */
function toXmlSafe(value: unknown): unknown {
  if (Array.isArray(value)) {
    return { item: value.map(toXmlSafe) };
  }
  if (value !== null && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      result[key] = toXmlSafe(val);
    }
    return result;
  }
  return value;
}
