import request from "supertest";
import { AuthService } from "../src/services/auth.service";
import { EmailService } from "../src/services/email.service";
import { OrganizationsService } from "../src/services/organizations.service";
import { UsersService } from "../src/services/users.service";
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

describe("POST /v1/auth/signup", () => {
  let fixtures: Fixtures;
  let authService: AuthService;
  let app: ReturnType<typeof buildTestApp>;

  beforeAll(() => {
    jest.spyOn(EmailService.prototype, "sendVerificationEmail").mockResolvedValue();
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    fixtures = await buildFixtures();
    authService = new AuthService(fixtures.users, fixtures.organizations);
    const usersService = new UsersService(fixtures.users, fixtures.organizations);
    const organizationsService = new OrganizationsService(fixtures.organizations);
    app = buildTestApp({ authService, usersService, organizationsService });
  });

  it("returns 201 with token, expiresAt, and public user on valid signup for automatic login", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({
        email: "newuser@example.com",
        password: "ValidPassword123!",
        role: "ORGANIZATION_ADMIN",
      });

    expect(res.status).toBe(201);
    expect(res.body.data).toHaveProperty("message");
    expect(typeof res.body.data.token).toBe("string");
    expect(res.body.data.token.split(".")).toHaveLength(3); // JWT: header.payload.signature
    expect(typeof res.body.data.expiresAt).toBe("string");
    expect(res.body.data.user.email).toBe("newuser@example.com");
    expect(res.body.data.user.role).toBe("ORGANIZATION_ADMIN");
    expect(res.body.data.user.emailVerified).toBe(false); // Email remains unverified pending verification
    expect(res.body.data.user).not.toHaveProperty("passwordHash");

    // Verify user exists in repository with unverified status and pending token
    const stored = await fixtures.users.findByEmail("newuser@example.com");
    expect(stored).not.toBeNull();
    expect(stored?.organizationId).toBeDefined();
    expect(stored?.emailVerified).toBe(false);
    expect(stored?.verificationTokenHash).toBeTruthy();

    // Verify organization exists in repository
    const org = await fixtures.organizations.findById(stored!.organizationId);
    expect(org).not.toBeNull();
  });

  it("allows newly registered user to authenticate immediate API requests using returned token without email verification blocking dashboard access", async () => {
    const signupRes = await request(app)
      .post("/auth/signup")
      .send({
        email: "auto-login@example.com",
        password: "ValidPassword123!",
        role: "ORGANIZATION_ADMIN",
      });

    expect(signupRes.status).toBe(201);
    const token = signupRes.body.data.token;
    expect(typeof token).toBe("string");
    expect(signupRes.body.data.user.emailVerified).toBe(false);

    // 1. Authenticate immediate request to protected GET /organizations/:id using signup JWT
    const orgRes = await request(app)
      .get(`/organizations/${signupRes.body.data.user.organizationId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(orgRes.status).toBe(200);
    expect(orgRes.body.data.id).toBe(signupRes.body.data.user.organizationId);

    // 2. Authenticate immediate request to protected GET /users/:id (used by frontend profile enrichment)
    const userRes = await request(app)
      .get(`/users/${signupRes.body.data.user.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(userRes.status).toBe(200);
    expect(userRes.body.data.id).toBe(signupRes.body.data.user.id);
    expect(userRes.body.data.email).toBe("auto-login@example.com");

    // 3. Confirm email verification status remains unverified in database
    const stored = await fixtures.users.findByEmail("auto-login@example.com");
    expect(stored?.emailVerified).toBe(false);
    expect(stored?.verificationTokenHash).toBeTruthy();
  });

  it("returns 409 when user with same email already exists", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({
        email: fixtures.adminA.email,
        password: "ValidPassword123!",
        role: "ORGANIZATION_ADMIN",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });

  it("returns 400 when password does not meet complexity requirements", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({
        email: "weakpw@example.com",
        password: "simple",
        role: "ORGANIZATION_ADMIN",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.message).toContain("Password must be at least");
  });

  it("returns 400 for invalid role", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({
        email: "badrole@example.com",
        password: "ValidPassword123!",
        role: "SUPER_GOD_ADMIN",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 for invalid email format", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({
        email: "not-an-email",
        password: "ValidPassword123!",
        role: "DEVELOPER",
      });

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("rolls back transaction and does not leave orphaned organization if user creation fails", async () => {
    let rolledBack = false;
    let createdOrgId: string | null = null;

    const mockTransactionalUsers: any = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockRejectedValue(new Error("Simulated database failure during user insert")),
      withTransaction: async (cb: any) => {
        try {
          return await cb({ mockClient: true });
        } catch (e) {
          rolledBack = true;
          // Clean up org in rollback simulation
          if (createdOrgId) {
            (fixtures.organizations as any).rows.delete(createdOrgId);
          }
          throw e;
        }
      },
    };

    const trackingOrgs: any = {
      create: async (name: string, slug: string) => {
        const org = await fixtures.organizations.create(name, slug);
        createdOrgId = org.id;
        return org;
      },
      findById: (id: string) => fixtures.organizations.findById(id),
    };

    const transactionalApp = buildTestApp({
      authService: new AuthService(mockTransactionalUsers, trackingOrgs),
    });

    const res = await request(transactionalApp)
      .post("/auth/signup")
      .send({
        email: "rollback-test@example.com",
        password: "ValidPassword123!",
        role: "DEVELOPER",
      });

    expect(res.status).toBe(500);
    expect(rolledBack).toBe(true);

    // Verify orphaned organization was not persisted
    const org = await fixtures.organizations.findById(createdOrgId!);
    expect(org).toBeNull();
  });

  it("maps PostgreSQL unique constraint violation (code 23505) to 409", async () => {
    const duplicateConstraintUsers: any = {
      findByEmail: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockRejectedValue({
        code: "23505",
        constraint: "users_email_unique",
        detail: "Key (email)=(race@example.com) already exists.",
      }),
      withTransaction: async (cb: any) => cb({}),
    };

    const appWithConstraint = buildTestApp({
      authService: new AuthService(duplicateConstraintUsers, fixtures.organizations),
    });

    const res = await request(appWithConstraint)
      .post("/auth/signup")
      .send({
        email: "race@example.com",
        password: "ValidPassword123!",
        role: "DEVELOPER",
      });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("EMAIL_ALREADY_EXISTS");
  });
});

describe("POST /v1/auth/verify-email and resend", () => {
  let fixtures: Fixtures;
  let authService: AuthService;
  let app: ReturnType<typeof buildTestApp>;

  beforeEach(async () => {
    fixtures = await buildFixtures();
    authService = new AuthService(fixtures.users, fixtures.organizations);
    app = buildTestApp({ authService });
  });

  it("returns 400 when verification token is missing", async () => {
    const res = await request(app).post("/auth/verify-email").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when resend verification email is missing", async () => {
    const res = await request(app).post("/auth/resend-verification").send({});

    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 with generic anti-enumeration message when resend is requested", async () => {
    const res = await request(app).post("/auth/resend-verification").send({
      email: "anybody@example.com",
    });

    expect(res.status).toBe(200);
    expect(res.body.data.message).toContain("If an account exists");
  });
});
