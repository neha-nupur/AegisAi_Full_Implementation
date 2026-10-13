import crypto from "crypto";
import { HttpError } from "@aegisai/shared-types";
import { toPublicUser } from "../domain/mappers";
import { isRole, permissionsForRole } from "../domain/rbac";
import type { UsersRepository } from "../repositories/users.repository";
import type { OrganizationsRepository } from "../repositories/organizations.repository";
import type { PublicUser } from "../types";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";
import { EmailService } from "./email.service";

export interface LoginResult {
  token: string;
  expiresAt: string;
  user: PublicUser;
}

export interface SignupResult {
  message: string;
  user: PublicUser;
}

// ─── Password validation ───────────────────────────────────────
const MIN_PASSWORD_LENGTH = 8;

export function validatePassword(password: string): string | null {
  if (!password || password.length < MIN_PASSWORD_LENGTH) {
    return `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`;
  }
  if (!/[A-Z]/.test(password)) return "Password must contain at least one uppercase letter.";
  if (!/[a-z]/.test(password)) return "Password must contain at least one lowercase letter.";
  if (!/[0-9]/.test(password)) return "Password must contain at least one digit.";
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) return "Password must contain at least one special character.";
  return null;
}

// ─── Token helpers ─────────────────────────────────────────────
const VERIFICATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
const RESET_TOKEN_EXPIRY_MS = 15 * 60 * 1000;             // 15 minutes

function generateSecureToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export class AuthService {
  private emailService: EmailService;

  constructor(
    private readonly users: UsersRepository,
    private readonly organizations: OrganizationsRepository,
    private readonly passwords: PasswordService = new PasswordService(),
    private readonly tokens: TokenService = new TokenService()
  ) {
    this.emailService = new EmailService();
  }

  // ─── LOGIN ─────────────────────────────────────────────────
  async login(email: string, password: string): Promise<LoginResult> {
    if (!email || !password) {
      throw new HttpError(400, "VALIDATION_ERROR", "email and password are required.");
    }

    const user = await this.users.findByEmail(email);
    if (!user) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    const passwordValid = await this.passwords.verify(password, user.passwordHash);
    if (!passwordValid) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Invalid email or password.");
    }

    if (user.status === "disabled") {
      throw new HttpError(403, "ACCOUNT_DISABLED", "This account has been disabled.");
    }


    const permissions = permissionsForRole(user.role);
    const issued = this.tokens.sign({
      userId: user.id,
      organizationId: user.organizationId,
      role: user.role,
      permissions,
    });

    return { token: issued.token, expiresAt: issued.expiresAt, user: toPublicUser(user) };
  }

  // ─── SIGNUP ────────────────────────────────────────────────
  async signup(email: string, password: string, role: string): Promise<SignupResult> {
    if (!email || !password || !role) {
      throw new HttpError(400, "VALIDATION_ERROR", "email, password and role are required.");
    }

    // Validate email format
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid email format.");
    }

    if (!isRole(role)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Invalid role specified.");
    }

    // Validate password strength
    const pwError = validatePassword(password);
    if (pwError) {
      throw new HttpError(400, "VALIDATION_ERROR", pwError);
    }

    const existing = await this.users.findByEmail(email);
    if (existing) {
      throw new HttpError(409, "EMAIL_ALREADY_EXISTS", "A user with this email already exists.");
    }

    // Generate a basic org name from email domain
    const domain = email.includes("@") ? email.split("@")[1] : "default";
    const orgName = `${domain} Organization`;
    const orgSlug = `${domain.replace(/[^a-zA-Z0-9]/g, "-").toLowerCase()}-${Date.now()}`;

    const organization = await this.organizations.create(orgName, orgSlug);
    const passwordHash = await this.passwords.hash(password);

    // Generate verification token
    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS).toISOString();

    const user = await this.users.create({
      organizationId: organization.id,
      email,
      passwordHash,
      role: role as any,
    });

    // Store verification token hash on the user
    await this.users.update(user.id, {
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt,
    });

    try {
      await this.emailService.sendVerificationEmail(email, rawToken, role as string);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[AuthService] [TRACE_ID: ${Date.now()}] Failed to send registration email to [REDACTED_EMAIL_PREFIX]...${email.split('@')[1]}: ${errorMsg}`);
    }

    return {
      message: "Account created. Please check your email to verify your account.",
      user: toPublicUser(user),
    };
  }

  // ─── VERIFY EMAIL ──────────────────────────────────────────
  async verifyEmail(token: string): Promise<{ message: string }> {
    if (!token) {
      throw new HttpError(400, "VALIDATION_ERROR", "Verification token is required.");
    }

    const tokenHash = hashToken(token);

    // Find user with this verification token hash
    // We need to search — use a raw query or iterate. For security, iterate is fine at scale.
    // Since we don't have a findByVerificationToken, we'll add a method or use the pool directly.
    // For now, use a simple approach: the token is unique, so we search by hash.
    const user = await this.findUserByVerificationTokenHash(tokenHash);
    if (!user) {
      throw new HttpError(400, "INVALID_TOKEN", "Invalid or expired verification link.");
    }

    if (user.emailVerified) {
      return { message: "Email already verified." };
    }

    if (!user.verificationTokenExpiresAt || new Date(user.verificationTokenExpiresAt) < new Date()) {
      throw new HttpError(400, "TOKEN_EXPIRED", "This verification link has expired. Please request a new one.");
    }

    // Verify and clear token
    await this.users.update(user.id, {
      emailVerified: true,
      verificationTokenHash: null as any,
      verificationTokenExpiresAt: null as any,
    });

    return { message: "Email verified successfully. You can now sign in." };
  }

  // ─── RESEND VERIFICATION ──────────────────────────────────
  async resendVerification(email: string): Promise<{ message: string }> {
    if (!email) {
      throw new HttpError(400, "VALIDATION_ERROR", "Email is required.");
    }

    // Generic response to avoid account enumeration
    const genericMessage = "If an account exists for this email and is not yet verified, a new verification email has been sent.";

    const user = await this.users.findByEmail(email);
    if (!user || user.emailVerified) {
      return { message: genericMessage };
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + VERIFICATION_TOKEN_EXPIRY_MS).toISOString();

    await this.users.update(user.id, {
      verificationTokenHash: tokenHash,
      verificationTokenExpiresAt: expiresAt,
    });

    try {
      await this.emailService.sendVerificationEmail(email, rawToken, user.role);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[AuthService] [TRACE_ID: ${Date.now()}] Failed to resend verification email to [REDACTED_EMAIL_PREFIX]...${email.split('@')[1]}: ${errorMsg}`);
    }

    return { message: genericMessage };
  }

  // ─── FORGOT PASSWORD ──────────────────────────────────────
  async forgotPassword(email: string): Promise<{ message: string }> {
    if (!email) {
      throw new HttpError(400, "VALIDATION_ERROR", "Email is required.");
    }

    const genericMessage = "If an account exists for this email, password reset instructions have been sent.";

    const user = await this.users.findByEmail(email);
    if (!user) {
      return { message: genericMessage };
    }

    const rawToken = generateSecureToken();
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS).toISOString();

    await this.users.update(user.id, {
      resetTokenHash: tokenHash,
      resetTokenExpiresAt: expiresAt,
    });

    try {
      await this.emailService.sendPasswordResetEmail(email, rawToken);
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : "Unknown error";
      console.error(`[AuthService] [TRACE_ID: ${Date.now()}] Failed to send password reset email to [REDACTED_EMAIL_PREFIX]...${email.split('@')[1]}: ${errorMsg}`);
    }

    return { message: genericMessage };
  }

  // ─── RESET PASSWORD ───────────────────────────────────────
  async resetPassword(token: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    if (!token) {
      throw new HttpError(400, "VALIDATION_ERROR", "Reset token is required.");
    }
    if (!newPassword || !confirmPassword) {
      throw new HttpError(400, "VALIDATION_ERROR", "New password and confirmation are required.");
    }
    if (newPassword !== confirmPassword) {
      throw new HttpError(400, "VALIDATION_ERROR", "Passwords do not match.");
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
      throw new HttpError(400, "VALIDATION_ERROR", pwError);
    }

    const tokenHash = hashToken(token);
    const user = await this.findUserByResetTokenHash(tokenHash);

    if (!user) {
      throw new HttpError(400, "INVALID_TOKEN", "Invalid or expired password reset link.");
    }

    if (!user.resetTokenExpiresAt || new Date(user.resetTokenExpiresAt) < new Date()) {
      throw new HttpError(400, "TOKEN_EXPIRED", "This password reset link has expired.");
    }

    const passwordHash = await this.passwords.hash(newPassword);

    await this.users.update(user.id, {
      passwordHash,
      resetTokenHash: null as any,
      resetTokenExpiresAt: null as any,
    });

    return { message: "Password reset successfully. You can now sign in with your new password." };
  }

  // ─── CHANGE PASSWORD (logged-in user) ─────────────────────
  async changePassword(userId: string, currentPassword: string, newPassword: string, confirmPassword: string): Promise<{ message: string }> {
    if (!currentPassword || !newPassword || !confirmPassword) {
      throw new HttpError(400, "VALIDATION_ERROR", "Current password, new password and confirmation are required.");
    }
    if (newPassword !== confirmPassword) {
      throw new HttpError(400, "VALIDATION_ERROR", "New passwords do not match.");
    }

    const pwError = validatePassword(newPassword);
    if (pwError) {
      throw new HttpError(400, "VALIDATION_ERROR", pwError);
    }

    const user = await this.users.findById(userId);
    if (!user) {
      throw new HttpError(404, "USER_NOT_FOUND", "User not found.");
    }

    const valid = await this.passwords.verify(currentPassword, user.passwordHash);
    if (!valid) {
      throw new HttpError(401, "INVALID_CREDENTIALS", "Current password is incorrect.");
    }

    const passwordHash = await this.passwords.hash(newPassword);
    await this.users.update(user.id, { passwordHash });

    return { message: "Password changed successfully." };
  }

  // ─── Internal helpers ─────────────────────────────────────
  // These search the DB for users by token hash. In a real system with many users,
  // you'd add an indexed column or a separate tokens table. For this codebase,
  // querying by hash column is adequate.

  private async findUserByVerificationTokenHash(hash: string) {
    // We need to query by verification_token_hash — add to repository or use pool directly
    const { getPool } = await import("../db/pool");
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, organization_id, email, email_verified, password_hash, role, status,
              verification_token_hash, verification_token_expires_at,
              reset_token_hash, reset_token_expires_at, created_at, updated_at
       FROM users WHERE verification_token_hash = $1`,
      [hash]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      emailVerified: row.email_verified,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      verificationTokenHash: row.verification_token_hash,
      verificationTokenExpiresAt: row.verification_token_expires_at?.toISOString() ?? null,
      resetTokenHash: row.reset_token_hash,
      resetTokenExpiresAt: row.reset_token_expires_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    } as any;
  }

  private async findUserByResetTokenHash(hash: string) {
    const { getPool } = await import("../db/pool");
    const pool = getPool();
    const result = await pool.query(
      `SELECT id, organization_id, email, email_verified, password_hash, role, status,
              verification_token_hash, verification_token_expires_at,
              reset_token_hash, reset_token_expires_at, created_at, updated_at
       FROM users WHERE reset_token_hash = $1`,
      [hash]
    );
    if (!result.rows[0]) return null;
    const row = result.rows[0];
    return {
      id: row.id,
      organizationId: row.organization_id,
      email: row.email,
      emailVerified: row.email_verified,
      passwordHash: row.password_hash,
      role: row.role,
      status: row.status,
      verificationTokenHash: row.verification_token_hash,
      verificationTokenExpiresAt: row.verification_token_expires_at?.toISOString() ?? null,
      resetTokenHash: row.reset_token_hash,
      resetTokenExpiresAt: row.reset_token_expires_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString(),
    } as any;
  }
}
