import bcrypt from "bcrypt";

/**
 * Password hashing. Per CLAUDE.md section 10 / the Phase 2 security
 * rule: plaintext passwords are never stored — only this hash. 12
 * salt rounds is bcrypt's commonly recommended minimum for
 * server-side hashing in 2025+; bcrypt salts each hash automatically,
 * so no separate salt storage is needed.
 */
const SALT_ROUNDS = 12;

export class PasswordService {
  async hash(plainTextPassword: string): Promise<string> {
    return bcrypt.hash(plainTextPassword, SALT_ROUNDS);
  }

  async verify(plainTextPassword: string, passwordHash: string): Promise<boolean> {
    return bcrypt.compare(plainTextPassword, passwordHash);
  }
}
