import type { Organization, PublicServiceAccount, PublicUser, ServiceAccount, User } from "../types";

/** Strips secret fields before a user is ever sent to a client. */
export function toPublicUser(user: User): PublicUser {
  const { passwordHash: _pw, verificationTokenHash: _vt, resetTokenHash: _rt, ...publicUser } = user;
  return publicUser;
}

/** Strips `credentialHash` before a service account is ever sent to a client. */
export function toPublicServiceAccount(serviceAccount: ServiceAccount): PublicServiceAccount {
  const { credentialHash: _credentialHash, ...publicServiceAccount } = serviceAccount;
  return publicServiceAccount;
}

/** No secret fields today, but kept for symmetry and so a future field can't leak by omission. */
export function toPublicOrganization(organization: Organization): Organization {
  return organization;
}
