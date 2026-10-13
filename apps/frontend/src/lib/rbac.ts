/**
 * Frontend RBAC helpers — mirrors the existing backend RBAC definitions in
 * apps/identity-service/src/domain/rbac.ts.
 *
 * IMPORTANT: Frontend RBAC is UI-layer convenience only.
 * The backend enforces real authorization. A 403 from the API means the
 * backend rejected the action regardless of what the UI shows.
 */

export const ROLES = {
  ORGANIZATION_ADMIN: 'ORGANIZATION_ADMIN',
  DEVELOPER: 'DEVELOPER',
  SECURITY_AUDITOR: 'SECURITY_AUDITOR',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

export const PERMISSIONS = {
  // users
  CREATE_USER: 'create:user',
  READ_USER: 'read:user',
  UPDATE_USER: 'update:user',
  DELETE_USER: 'delete:user',
  // service accounts
  CREATE_SERVICE_ACCOUNT: 'create:service_account',
  READ_SERVICE_ACCOUNT: 'read:service_account',
  UPDATE_SERVICE_ACCOUNT: 'update:service_account',
  DELETE_SERVICE_ACCOUNT: 'delete:service_account',
  // organization
  READ_ORGANIZATION: 'read:organization',
  UPDATE_ORGANIZATION: 'update:organization',
  // AI requests
  CREATE_AI_REQUEST: 'create:ai_request',
  READ_AI_REQUEST: 'read:ai_request',
  // policies
  CREATE_POLICY: 'create:policy',
  READ_POLICY: 'read:policy',
  UPDATE_POLICY: 'update:policy',
  DELETE_POLICY: 'delete:policy',
  // approvals
  READ_APPROVAL: 'read:approval',
  DECIDE_APPROVAL: 'decide:approval',
  // audit
  READ_AUDIT: 'read:audit',
  READ_SECURITY_EVENT: 'read:security_event',
  // models/providers
  READ_MODEL: 'read:model',
  CREATE_MODEL: 'create:model',
  READ_PROVIDER: 'read:provider',
  CREATE_PROVIDER: 'create:provider',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  ORGANIZATION_ADMIN: Object.values(PERMISSIONS) as Permission[],
  DEVELOPER: [
    PERMISSIONS.CREATE_AI_REQUEST,
    PERMISSIONS.READ_AI_REQUEST,
    PERMISSIONS.READ_POLICY,
    PERMISSIONS.READ_APPROVAL,
    PERMISSIONS.READ_MODEL,
    PERMISSIONS.READ_PROVIDER,
    PERMISSIONS.READ_SERVICE_ACCOUNT,
    PERMISSIONS.CREATE_SERVICE_ACCOUNT,
    PERMISSIONS.READ_ORGANIZATION,
    PERMISSIONS.READ_USER,
  ],
  SECURITY_AUDITOR: [
    PERMISSIONS.READ_AI_REQUEST,
    PERMISSIONS.READ_AUDIT,
    PERMISSIONS.READ_SECURITY_EVENT,
    PERMISSIONS.READ_POLICY,
    PERMISSIONS.READ_APPROVAL,
    PERMISSIONS.DECIDE_APPROVAL,
    PERMISSIONS.READ_MODEL,
    PERMISSIONS.READ_PROVIDER,
    PERMISSIONS.READ_ORGANIZATION,
    PERMISSIONS.READ_USER,
  ],
};

export function hasPermission(role: string, permission: Permission): boolean {
  const perms = ROLE_PERMISSIONS[role as Role];
  return perms ? perms.includes(permission) : false;
}

export function hasRole(role: string, required: Role | Role[]): boolean {
  if (Array.isArray(required)) {
    return required.includes(role as Role);
  }
  return role === required;
}
