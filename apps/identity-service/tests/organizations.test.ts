import request from "supertest";
import { OrganizationsService } from "../src/services/organizations.service";
import { buildFixtures, issueTokenFor, type Fixtures } from "./support/fixtures";
import { buildTestApp } from "./support/test-app";

describe("Organization endpoints", () => {
  let fixtures: Fixtures;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(async () => {
    fixtures = await buildFixtures();
    app = buildTestApp({ organizationsService: new OrganizationsService(fixtures.organizations) });
  });

  it("returns the caller's own organization", async () => {
    const token = issueTokenFor(fixtures.adminA);

    const res = await request(app).get(`/organizations/${fixtures.orgA.id}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(fixtures.orgA.id);
  });

  it("allows ORGANIZATION_ADMIN to update their own organization", async () => {
    const token = issueTokenFor(fixtures.adminA);

    const res = await request(app)
      .patch(`/organizations/${fixtures.orgA.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Renamed Org A" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("Renamed Org A");
  });

  it("returns 404 (not 403) when requesting a different organization — cross-organization access", async () => {
    const token = issueTokenFor(fixtures.adminA);

    const res = await request(app).get(`/organizations/${fixtures.orgB.id}`).set("Authorization", `Bearer ${token}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ORGANIZATION_NOT_FOUND");
  });

  it("returns 404 when attempting to update a different organization", async () => {
    const token = issueTokenFor(fixtures.adminA);

    const res = await request(app)
      .patch(`/organizations/${fixtures.orgB.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "Hijacked" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("ORGANIZATION_NOT_FOUND");
  });
});
