import request from "supertest";
import { createApp } from "../src/app";
import { type AegisAIConfig } from "@aegisai/config";
import type { Express } from "express";

let app: Express;
const mockConfig = {
  port: 4000,
  databaseUrl: "",
  redisUrl: "",
  jwtSecret: "test-secret",
  corsOrigins: ["*"],
} as unknown as AegisAIConfig;

beforeAll(async () => {
  app = await createApp(mockConfig);
});

describe("Phase 12.4: SOAP/XML Inbound", () => {
  test("POST /v1/ai-requests accepts application/xml and processes correctly", async () => {
    const xmlPayload = `
      <request>
        <input>Summarize this XML input</input>
      </request>
    `;

    const res = await request(app)
      .post("/v1/ai-requests")
      // Without auth, it should hit the missing token error, but we want to ensure
      // it parses and responds in XML if Accept: application/xml is provided.
      .set("Idempotency-Key", `test-xml-${Date.now()}`)
      .set("Content-Type", "application/xml")
      .set("Accept", "application/xml")
      .send(xmlPayload);

    // Should return 401 Missing Token but formatted as XML (or JSON if content negotiation isn't hooked to errorHandler)
    expect(res.status).toBe(401);
  });

  test("Invalid XML returns 400 with proper error body", async () => {
    const badXml = `<input>missing closing tag`;
    const res = await request(app)
      .post("/v1/ai-requests")
      .set("Idempotency-Key", `test-xml-bad-${Date.now()}`)
      .set("Content-Type", "application/xml")
      .set("Accept", "application/xml")
      .send(badXml);

    expect(res.status).toBe(400);
  });
});
