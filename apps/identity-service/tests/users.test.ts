import request from "supertest";
import { OrganizationsService } from "../src/services/organizations.service";
import { UsersService } from "../src/services/users.service";
import { buildFixtures, issueTokenFor, type Fixtures } from "./support/fixtures";
import { buildTestApp } from "./support/test-app";

describe("Users endpoints", () => {
  let fixtures: Fixtures;
  let app: ReturnType<typeof buildTestApp>;
  let adminAToken: string;

  beforeEach(async () => {
    fixtures = await buildFixtures();
    app = buildTestApp({
      usersService: new UsersService(fixtures.users, fixtures.organizations),
      organizationsService: new OrganizationsService(fixtures.organizations),
    });
    adminAToken = issueTokenFor(fixtures.adminA);
  });

  it("creates a user within the caller's organization", async () => {
    const res = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ email: "new-hire@org-a.test", password: "a-strong-password-1", role: "DEVELOPER" });

    expect(res.status).toBe(201);
    expect(res.body.data.email).toBe("new-hire@org-a.test");
    expect(res.body.data.organizationId).toBe(fixtures.orgA.id);
    expect(res.body.data).not.toHaveProperty("passwordHash");
  });

  it("rejects creation with an unknown role", async () => {
    const res = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ email: "bad-role@org-a.test", password: "a-strong-password-1", role: "SUPERUSER" });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rejects creation with a duplicate email", async () => {
    const res = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ email: fixtures.developerA.email, password: "a-strong-password-1", role: "DEVELOPER" });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("lists only users in the caller's own organization", async () => {
    const res = await request(app).get("/users").set("Authorization", `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    const ids: string[] = res.body.data.map((u: { id: string }) => u.id);
    expect(ids).toEqual(expect.arrayContaining([fixtures.adminA.id, fixtures.developerA.id, fixtures.auditorA.id, fixtures.disabledA.id]));
    expect(ids).not.toContain(fixtures.adminB.id);
  });

  it("gets a single user by id within the same organization", async () => {
    const res = await request(app)
      .get(`/users/${fixtures.developerA.id}`)
      .set("Authorization", `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.id).toBe(fixtures.developerA.id);
  });

  it("updates a user's role and status", async () => {
    const res = await request(app)
      .patch(`/users/${fixtures.developerA.id}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ role: "SECURITY_AUDITOR" });

    expect(res.status).toBe(200);
    expect(res.body.data.role).toBe("SECURITY_AUDITOR");
  });

  it("disables a user via DELETE (soft-delete, not a hard delete)", async () => {
    const res = await request(app)
      .delete(`/users/${fixtures.developerA.id}`)
      .set("Authorization", `Bearer ${adminAToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe("disabled");

    // Still fetchable afterward — proves it was disabled, not deleted.
    const getRes = await request(app)
      .get(`/users/${fixtures.developerA.id}`)
      .set("Authorization", `Bearer ${adminAToken}`);
    expect(getRes.status).toBe(200);
    expect(getRes.body.data.status).toBe("disabled");
  });

  it("returns 404 (not 403) for a user in a different organization — cross-organization access", async () => {
    const res = await request(app)
      .get(`/users/${fixtures.adminB.id}`)
      .set("Authorization", `Bearer ${adminAToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("USER_NOT_FOUND");
  });

  it("cannot update a user in a different organization — cross-organization access", async () => {
    const res = await request(app)
      .patch(`/users/${fixtures.adminB.id}`)
      .set("Authorization", `Bearer ${adminAToken}`)
      .send({ role: "DEVELOPER" });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("USER_NOT_FOUND");
  });
});
