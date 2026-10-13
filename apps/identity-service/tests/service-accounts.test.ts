import request from "supertest";
import { ServiceAccountsService } from "../src/services/service-accounts.service";
import { buildFixtures, issueTokenFor, type Fixtures } from "./support/fixtures";
import { buildTestApp } from "./support/test-app";

describe("Service account endpoints", () => {
  let fixtures: Fixtures;
  let app: ReturnType<typeof buildTestApp>;
  let adminAToken: string;

  beforeEach(async () => {
    fixtures = await buildFixtures();
    app = buildTestApp({ serviceAccountsService: new ServiceAccountsService(fixtures.serviceAccounts) });
    adminAToken = issueTokenFor(fixtures.adminA);
  });

  it("creates a service account and returns the plaintext credential exactly once", async () => {
    const res = await request(app)
      .post("/service-accounts")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ name: "ci-pipeline", permissions: ["service_accounts:read"] });

    expect(res.status).toBe(201);
    expect(res.body.data.serviceAccount.name).toBe("ci-pipeline");
    expect(res.body.data.serviceAccount.organizationId).toBe(fixtures.orgA.id);
    expect(res.body.data.serviceAccount).not.toHaveProperty("credentialHash");
    expect(typeof res.body.data.credential).toBe("string");
    expect(res.body.data.credential).toMatch(/^sak_/);
  });

  it("rejects creation with an invalid permission string", async () => {
    const res = await request(app)
      .post("/service-accounts")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ name: "bad-perms", permissions: ["not_a_real_permission"] });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("lists only service accounts in the caller's own organization", async () => {
    await request(app)
      .post("/service-accounts")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ name: "ci-pipeline", permissions: ["service_accounts:read"] });

    const res = await request(app).get("/service-accounts").set("Authorization", `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].organizationId).toBe(fixtures.orgA.id);
  });

  it("updates a service account's permissions", async () => {
    const created = await request(app)
      .post("/service-accounts")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ name: "ci-pipeline", permissions: ["service_accounts:read"] });

    const res = await request(app)
      .patch(`/service-accounts/${created.body.data.serviceAccount.id}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ permissions: ["service_accounts:read", "service_accounts:write"] });

    expect(res.status).toBe(200);
    expect(res.body.data.permissions).toEqual(["service_accounts:read", "service_accounts:write"]);
  });

  it("disables a service account via DELETE (soft-delete)", async () => {
    const created = await request(app)
      .post("/service-accounts")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ name: "ci-pipeline", permissions: ["service_accounts:read"] });

    const res = await request(app)
      .delete(`/service-accounts/${created.body.data.serviceAccount.id}`)
      .set("Authorization", `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("disabled");
  });

  it("returns 404 when updating a service account from a different organization", async () => {
    const created = await request(app)
      .post("/service-accounts")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ name: "ci-pipeline", permissions: ["service_accounts:read"] });

    const adminBToken = issueTokenFor(fixtures.adminB);
    const res = await request(app)
      .patch(`/service-accounts/${created.body.data.serviceAccount.id}`)
      .set("Authorization", `Bearer ${adminBToken}`)
      .send({ name: "hijacked" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("SERVICE_ACCOUNT_NOT_FOUND");
  });
});
