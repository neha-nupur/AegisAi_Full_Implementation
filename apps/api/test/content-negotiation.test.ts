import request from "supertest";
import { createApp } from "../src/app";
import type { Express } from "express";
import type { AegisAIConfig } from "@aegisai/config";

const testConfig: AegisAIConfig = {
  nodeEnv: "test",
  port: 0,
  databaseUrl: "postgresql://test:test@localhost:5432/test",
  mongodbUrl: "mongodb://localhost:27017/test",
  redisUrl: "redis://localhost:6379",
  jwtSecret: "test-secret",
  jwtExpiresIn: "15m",
  corsOrigins: ["http://localhost:5173"],
  soapMockUrl: "http://localhost:5005",
};

/**
 * Phase 10: XML content negotiation, tested against two DB-free
 * endpoints (`GET /health`'s plain object body, and the 404 error
 * envelope) so this suite doesn't require a live Postgres/Mongo/Redis
 * connection — same reasoning as `services-health.test.ts`. Every
 * mounted business route goes through the same global middleware
 * (`contentNegotiationMiddleware`), so these two representative
 * response shapes (a flat object, and the nested `{ error: {...} }`
 * envelope) are sufficient evidence the mechanism itself works
 * correctly for "the same logical resource represented in both
 * formats" — see that middleware's own doc comment for why this is
 * applied globally rather than duplicated per endpoint.
 */
describe("XML/JSON content negotiation", () => {
  let app: Express;

  beforeAll(async () => {
    app = await createApp(testConfig);
  });

  it("defaults to JSON when no Accept header is sent", async () => {
    const res = await request(app).get("/health");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns JSON when Accept: application/json is sent explicitly", async () => {
    const res = await request(app).get("/health").set("Accept", "application/json");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("returns XML when Accept: application/xml is sent, representing the same logical resource", async () => {
    const res = await request(app).get("/health").set("Accept", "application/xml");
    expect(res.headers["content-type"]).toMatch(/application\/xml/);
    expect(res.text).toContain("<response>");
    expect(res.text).toContain("<status>ok</status>");
  });

  it("treats Accept: */* as JSON (the safe default for clients that accept anything)", async () => {
    const res = await request(app).get("/health").set("Accept", "*/*");
    expect(res.headers["content-type"]).toMatch(/application\/json/);
  });

  it("represents the standard error envelope in XML too, with the same fields as the JSON version", async () => {
    const jsonRes = await request(app).get("/does-not-exist").set("Accept", "application/json");
    const xmlRes = await request(app).get("/does-not-exist").set("Accept", "application/xml");

    expect(jsonRes.status).toBe(404);
    expect(xmlRes.status).toBe(404);
    expect(xmlRes.headers["content-type"]).toMatch(/application\/xml/);
    expect(xmlRes.text).toContain("<code>NOT_FOUND</code>");
    expect(xmlRes.text).toContain(`<message>${jsonRes.body.error.message}</message>`);
  });
});
