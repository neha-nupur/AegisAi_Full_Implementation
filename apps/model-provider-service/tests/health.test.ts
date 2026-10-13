import express from "express";
import request from "supertest";
import { modelProviderRouter, SERVICE_NAME } from "../src";

describe("Model & Provider Management Service — GET /health", () => {
  const app = express();
  app.use(modelProviderRouter);

  it("returns 200 with the service's own status payload", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.service).toBe(SERVICE_NAME);
    expect(res.body.status).toBe("ok");
    expect(typeof res.body.timestamp).toBe("string");
  });
});
