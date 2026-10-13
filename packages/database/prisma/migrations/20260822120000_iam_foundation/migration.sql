CREATE TYPE "UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'LOCKED');
CREATE TYPE "SessionStatus" AS ENUM ('ACTIVE', 'ROTATED', 'REVOKED', 'EXPIRED');
CREATE TYPE "AuditOutcome" AS ENUM ('SUCCESS', 'FAILURE');

CREATE TABLE "iam_users" (
  "id" UUID NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "displayName" VARCHAR(160) NOT NULL,
  "passwordHash" VARCHAR(255) NOT NULL,
  "status" "UserStatus" NOT NULL DEFAULT 'ACTIVE',
  "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  "lockedUntil" TIMESTAMPTZ(3),
  "passwordChangedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastLoginAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "iam_users_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iam_roles" (
  "id" UUID NOT NULL, "code" VARCHAR(80) NOT NULL, "name" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500), "isSystem" BOOLEAN NOT NULL DEFAULT false,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "iam_roles_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iam_permissions" (
  "id" UUID NOT NULL, "code" VARCHAR(120) NOT NULL, "module" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL, "description" VARCHAR(500),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "iam_permissions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "branches" (
  "id" UUID NOT NULL, "code" VARCHAR(40) NOT NULL, "name" VARCHAR(160) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL, CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iam_user_roles" (
  "userId" UUID NOT NULL, "roleId" UUID NOT NULL,
  "assignedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "iam_user_roles_pkey" PRIMARY KEY ("userId", "roleId")
);

CREATE TABLE "iam_role_permissions" (
  "roleId" UUID NOT NULL, "permissionId" UUID NOT NULL,
  "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "iam_role_permissions_pkey" PRIMARY KEY ("roleId", "permissionId")
);

CREATE TABLE "iam_user_branches" (
  "userId" UUID NOT NULL, "branchId" UUID NOT NULL, "isPrimary" BOOLEAN NOT NULL DEFAULT false,
  "grantedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "iam_user_branches_pkey" PRIMARY KEY ("userId", "branchId")
);

CREATE TABLE "iam_sessions" (
  "id" UUID NOT NULL, "userId" UUID NOT NULL, "familyId" UUID NOT NULL,
  "refreshTokenHash" CHAR(64) NOT NULL, "status" "SessionStatus" NOT NULL DEFAULT 'ACTIVE',
  "expiresAt" TIMESTAMPTZ(3) NOT NULL, "lastUsedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revokedAt" TIMESTAMPTZ(3), "revokedReason" VARCHAR(160), "ipAddress" VARCHAR(64),
  "userAgent" VARCHAR(500), "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "iam_sessions_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "iam_audit_events" (
  "id" UUID NOT NULL, "actorUserId" UUID, "action" VARCHAR(120) NOT NULL,
  "entityType" VARCHAR(80) NOT NULL, "entityId" VARCHAR(160), "outcome" "AuditOutcome" NOT NULL,
  "metadata" JSONB, "ipAddress" VARCHAR(64), "userAgent" VARCHAR(500),
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "iam_audit_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "iam_users_email_key" ON "iam_users"("email");
CREATE UNIQUE INDEX "iam_roles_code_key" ON "iam_roles"("code");
CREATE UNIQUE INDEX "iam_permissions_code_key" ON "iam_permissions"("code");
CREATE UNIQUE INDEX "branches_code_key" ON "branches"("code");
CREATE INDEX "iam_user_roles_roleId_idx" ON "iam_user_roles"("roleId");
CREATE INDEX "iam_role_permissions_permissionId_idx" ON "iam_role_permissions"("permissionId");
CREATE INDEX "iam_user_branches_branchId_idx" ON "iam_user_branches"("branchId");
CREATE INDEX "iam_sessions_userId_status_idx" ON "iam_sessions"("userId", "status");
CREATE INDEX "iam_sessions_familyId_idx" ON "iam_sessions"("familyId");
CREATE INDEX "iam_sessions_expiresAt_idx" ON "iam_sessions"("expiresAt");
CREATE INDEX "iam_audit_events_actorUserId_occurredAt_idx" ON "iam_audit_events"("actorUserId", "occurredAt");
CREATE INDEX "iam_audit_events_action_occurredAt_idx" ON "iam_audit_events"("action", "occurredAt");

ALTER TABLE "iam_user_roles" ADD CONSTRAINT "iam_user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iam_user_roles" ADD CONSTRAINT "iam_user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "iam_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "iam_role_permissions" ADD CONSTRAINT "iam_role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "iam_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iam_role_permissions" ADD CONSTRAINT "iam_role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "iam_permissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "iam_user_branches" ADD CONSTRAINT "iam_user_branches_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iam_user_branches" ADD CONSTRAINT "iam_user_branches_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "iam_sessions" ADD CONSTRAINT "iam_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "iam_audit_events" ADD CONSTRAINT "iam_audit_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
