CREATE TABLE "b2b_organization_users" (
  "id" UUID NOT NULL,
  "organizationId" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "roleName" VARCHAR(120) NOT NULL,
  "sections" TEXT[] NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "b2b_organization_users_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "b2b_organization_users_sections_check" CHECK (
    cardinality("sections") <= 6 AND array_position("sections", NULL) IS NULL
    AND "sections" <@ ARRAY['organization','access','contracts','credit','finance','audit']::TEXT[]
    AND (NOT "isActive" OR cardinality("sections") > 0)
  ),
  CONSTRAINT "b2b_organization_users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "master_organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "b2b_organization_users_userId_fkey" FOREIGN KEY ("userId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "b2b_organization_users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "b2b_organization_users_userId_key" ON "b2b_organization_users"("userId");
CREATE INDEX "b2b_organization_users_organizationId_branchId_isActive_idx" ON "b2b_organization_users"("organizationId", "branchId", "isActive");
