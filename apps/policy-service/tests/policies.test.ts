import request from "supertest";
import { PoliciesService } from "../src/services/policies.service";
import { InMemoryPoliciesRepository } from "./support/in-memory-policies.repository";
import { buildPrincipal, issueTokenFor } from "./support/fixtures";
import { buildTestApp } from "./support/test-app";

describe("Policy CRUD — /v1/policies", () => {
  function buildApp() {
    const repository = new InMemoryPoliciesRepository();
    const service = new PoliciesService(repository);
    const app = buildTestApp({ policiesService: service });
    return { app, repository };
  }

  const sampleRules = [
    { id: "block-secrets", action: "BLOCK", when: { findingTypes: ["API_KEY"] } },
    { id: "fallback", action: "ALLOW" },
  ];

  test("ORGANIZATION_ADMIN can create a policy", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("ORGANIZATION_ADMIN"));

    const res = await request(app).post("/policies").set("Authorization", `Bearer ${token}`).send({ name: "Org Policy", rules: sampleRules });

    expect(res.status).toBe(201);
    expect(res.body.data.name).toBe("Org Policy");
    expect(res.body.data.version).toBe(1);
    expect(res.body.data.status).toBe("ACTIVE");
  });

  test("DEVELOPER cannot create a policy (403)", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("DEVELOPER"));

    const res = await request(app).post("/policies").set("Authorization", `Bearer ${token}`).send({ name: "Nope", rules: sampleRules });

    expect(res.status).toBe(403);
  });

  test("DEVELOPER can read policies", async () => {
    const { app } = buildApp();
    const principal = buildPrincipal("ORGANIZATION_ADMIN");
    const adminToken = issueTokenFor(principal);
    await request(app).post("/policies").set("Authorization", `Bearer ${adminToken}`).send({ name: "P1", rules: sampleRules });

    const devToken = issueTokenFor(buildPrincipal("DEVELOPER", principal.organizationId));
    const res = await request(app).get("/policies").set("Authorization", `Bearer ${devToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
  });

  test("invalid policy body (missing rules) is rejected with 400", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("ORGANIZATION_ADMIN"));

    const res = await request(app).post("/policies").set("Authorization", `Bearer ${token}`).send({ name: "No rules" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("PATCH bumps the version and updates fields", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("ORGANIZATION_ADMIN"));
    const created = await request(app).post("/policies").set("Authorization", `Bearer ${token}`).send({ name: "P1", rules: sampleRules });

    const res = await request(app)
      .patch(`/policies/${created.body.data.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "INACTIVE" });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("INACTIVE");
    expect(res.body.data.version).toBe(2);
  });

  test("a policy in another organization is 404, not 403", async () => {
    const { app } = buildApp();
    const ownerToken = issueTokenFor(buildPrincipal("ORGANIZATION_ADMIN"));
    const created = await request(app).post("/policies").set("Authorization", `Bearer ${ownerToken}`).send({ name: "P1", rules: sampleRules });

    const otherToken = issueTokenFor(buildPrincipal("ORGANIZATION_ADMIN"));
    const res = await request(app).get(`/policies/${created.body.data.id}`).set("Authorization", `Bearer ${otherToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("POLICY_NOT_FOUND");
  });

  test("DELETE removes the policy (204), then GET is 404", async () => {
    const { app } = buildApp();
    const token = issueTokenFor(buildPrincipal("ORGANIZATION_ADMIN"));
    const created = await request(app).post("/policies").set("Authorization", `Bearer ${token}`).send({ name: "P1", rules: sampleRules });

    const del = await request(app).delete(`/policies/${created.body.data.id}`).set("Authorization", `Bearer ${token}`);
    expect(del.status).toBe(204);

    const get = await request(app).get(`/policies/${created.body.data.id}`).set("Authorization", `Bearer ${token}`);
    expect(get.status).toBe(404);
  });

  test("missing JWT is rejected with 401", async () => {
    const { app } = buildApp();
    const res = await request(app).get("/policies");
    expect(res.status).toBe(401);
  });
});
