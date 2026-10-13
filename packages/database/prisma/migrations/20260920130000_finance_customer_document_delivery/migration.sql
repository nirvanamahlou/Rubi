CREATE TABLE "finance_customer_document_delivery_revisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "contractId" UUID NOT NULL,
  "branchId" UUID NOT NULL,
  "version" INTEGER NOT NULL CHECK ("version" > 0),
  "approved" BOOLEAN NOT NULL,
  "basis" VARCHAR(32) NOT NULL,
  "reason" VARCHAR(500) NOT NULL,
  "secondApproverRef" UUID,
  "exceptionExpiresAt" TIMESTAMPTZ(3),
  "actorUserId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_customer_document_delivery_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "finance_customer_document_delivery_revisions_basis_check"
    CHECK ("basis" IN ('AFTER_RECEIPT', 'FULL_SETTLEMENT', 'MANAGER_EXCEPTION')),
  CONSTRAINT "finance_customer_document_delivery_revisions_reason_check"
    CHECK (btrim("reason") <> ''),
  CONSTRAINT "finance_customer_document_delivery_revisions_exception_check"
    CHECK (
      NOT "approved"
      OR "basis" <> 'MANAGER_EXCEPTION'
      OR (
        "secondApproverRef" IS NOT NULL
        AND "secondApproverRef" <> "actorUserId"
        AND "exceptionExpiresAt" IS NOT NULL
        AND "exceptionExpiresAt" > "createdAt"
      )
    ),
  CONSTRAINT "finance_customer_document_delivery_revisions_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "finance_customer_document_delivery_revisions_contractId_version_key"
  ON "finance_customer_document_delivery_revisions"("contractId", "version");
CREATE INDEX "finance_customer_document_delivery_revisions_branchId_createdAt_idx"
  ON "finance_customer_document_delivery_revisions"("branchId", "createdAt");