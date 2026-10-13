import request from "supertest";
import { AuthService } from "../src/services/auth.service";
import { buildFixtures, type Fixtures } from "./support/fixtures";
import { buildTestApp } from "./support/test-app";

describe("POST /v1/auth/login", () => {
  let fixtures: Fixtures;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(async () => {
    fixtures = await buildFixtures();
    app = buildTestApp({ authService: new AuthService(fixtures.users, fixtures.organizations) });
  });

  it("returns 200 with a token and the public user on valid credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: fixtures.adminA.email, password: fixtures.passwords.adminA });

    expect(res.status).toBe(200);
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.token.split(".")).toHaveLength(3); // header.payload.signature
    expect(res.body.data.user.id).toBe(fixtures.adminA.id);
    expect(res.body.data.user.email).toBe(fixtures.adminA.email);
    expect(res.body.data.user).not.toHaveProperty("passwordHash");
  });

  it("returns 401 for an invalid password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: fixtures.adminA.email, password: "definitely-the-wrong-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 401 for an unknown user, with the same generic message as a wrong password", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@nowhere.test", password: "whatever-password" });

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
  });

  it("returns 403 for a disabled user's correct credentials", async () => {
    const res = await request(app)
      .post("/auth/login")
      .send({ email: fixtures.disabledA.email, password: fixtures.passwords.disabledA });

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("ACCOUNT_DISABLED");
  });

  it("returns 400 when email or password is missing", async () => {
    const res = await request(app).post("/auth/login").send({ email: fixtures.adminA.email });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });
});
