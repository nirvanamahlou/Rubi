CREATE TABLE "procurement_categories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branchId" UUID NOT NULL,
  "label" VARCHAR(80) NOT NULL,
  "normalizedLabel" VARCHAR(160) NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT TRUE,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "procurement_categories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "procurement_categories_label_nonblank" CHECK (length(btrim("label")) > 0),
  CONSTRAINT "procurement_categories_normalized_nonblank" CHECK (length(btrim("normalizedLabel")) > 0),
  CONSTRAINT "procurement_categories_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT "procurement_categories_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX "procurement_categories_branchId_normalizedLabel_key" ON "procurement_categories"("branchId", "normalizedLabel");
CREATE INDEX "procurement_categories_branchId_isActive_label_idx" ON "procurement_categories"("branchId", "isActive", "label");
