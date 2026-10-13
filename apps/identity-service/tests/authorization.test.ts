import jwt from "jsonwebtoken";
import request from "supertest";
import { OrganizationsService } from "../src/services/organizations.service";
import { UsersService } from "../src/services/users.service";
import { buildFixtures, issueTokenFor, type Fixtures } from "./support/fixtures";
import { buildTestApp } from "./support/test-app";

describe("Identity authorization middleware (authenticateJWT / requireRole / requirePermission)", () => {
  let fixtures: Fixtures;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(async () => {
    fixtures = await buildFixtures();
    app = buildTestApp({
      usersService: new UsersService(fixtures.users, fixtures.organizations),
      organizationsService: new OrganizationsService(fixtures.organizations),
    });
  });

  it("returns 401 when the Authorization header is missing", async () => {
    const res = await request(app).get("/users");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("MISSING_TOKEN");
  });

  it("returns 401 for a malformed/invalid token", async () => {
    const res = await request(app).get("/users").set("Authorization", "Bearer not-a-real-jwt");

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });

  it("returns 401 for a token signed with the wrong secret", async () => {
    const forged = jwt.sign({ organizationId: fixtures.orgA.id, role: "ORGANIZATION_ADMIN", permissions: [] }, "not-the-real-secret", {
      subject: fixtures.adminA.id,
      expiresIn: "15m",
    });

    const res = await request(app).get("/users").set("Authorization", `Bearer ${forged}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_INVALID");
  });

  it("returns 401 for an expired token", async () => {
    const expired = jwt.sign(
      { organizationId: fixtures.orgA.id, role: "ORGANIZATION_ADMIN", permissions: ["users:read"] },
      process.env.JWT_SECRET as string,
      { subject: fixtures.adminA.id, expiresIn: "-10s" } // already expired
    );

    const res = await request(app).get("/users").set("Authorization", `Bearer ${expired}`);

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("TOKEN_EXPIRED");
  });

  it("returns 403 when the caller's role lacks the required role (wrong role)", async () => {
    // Organization update is gated with requireRole("ORGANIZATION_ADMIN");
    // a DEVELOPER has a valid token but the wrong role for this action.
    const token = issueTokenFor(fixtures.developerA);

    const res = await request(app)
      .patch(`/organizations/${fixtures.orgA.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("succeeds when the caller's role matches (correct role)", async () => {
    const token = issueTokenFor(fixtures.adminA);

    const res = await request(app)
      .patch(`/organizations/${fixtures.orgA.id}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ name: "New Name" });

    expect(res.status).toBe(200);
    expect(res.body.data.name).toBe("New Name");
  });

  it("returns 403 when the caller lacks the required permission", async () => {
    // SECURITY_AUDITOR has users:read but not users:write.
    const token = issueTokenFor(fixtures.auditorA);

    const res = await request(app)
      .post("/users")
      .set("Authorization", `Bearer ${token}`)
      .send({ email: "new@org-a.test", password: "some-password-1", role: "DEVELOPER" });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });
});
