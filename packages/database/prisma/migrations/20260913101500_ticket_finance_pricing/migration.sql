CREATE TABLE "finance_ticket_pricing_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "ticketOfferId" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    "version" INTEGER NOT NULL DEFAULT 0,
    "requestedByUserId" UUID NOT NULL,
    "requestedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "finance_ticket_pricing_requests_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finance_ticket_pricing_requests_status_check" CHECK ("status" IN ('PENDING', 'PRICED')),
    CONSTRAINT "finance_ticket_pricing_requests_version_check" CHECK ("version" >= 0)
);

CREATE TABLE "finance_ticket_pricing_revisions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "requestId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "purchaseAmount" DECIMAL(24,4) NOT NULL,
    "currencyCode" VARCHAR(3) NOT NULL,
    "feeAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "commission" DECIMAL(24,4) NOT NULL DEFAULT 0,
    "actorUserId" UUID NOT NULL,
    "idempotencyKey" VARCHAR(160) NOT NULL,
    "fingerprint" VARCHAR(64) NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "finance_ticket_pricing_revisions_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "finance_ticket_pricing_revisions_amounts_check" CHECK ("purchaseAmount" >= 0 AND "feeAmount" >= 0 AND "commission" >= 0),
    CONSTRAINT "finance_ticket_pricing_revisions_currency_check" CHECK ("currencyCode" ~ '^[A-Z]{3}$'),
    CONSTRAINT "finance_ticket_pricing_revisions_version_check" CHECK ("version" > 0)
);

CREATE UNIQUE INDEX "finance_ticket_pricing_requests_ticketOfferId_key" ON "finance_ticket_pricing_requests"("ticketOfferId");
CREATE INDEX "finance_ticket_pricing_requests_branchId_status_requestedAt_idx" ON "finance_ticket_pricing_requests"("branchId", "status", "requestedAt");
CREATE UNIQUE INDEX "finance_ticket_pricing_revisions_requestId_version_key" ON "finance_ticket_pricing_revisions"("requestId", "version");
CREATE UNIQUE INDEX "finance_ticket_pricing_revisions_actorUserId_idempotencyKey_key" ON "finance_ticket_pricing_revisions"("actorUserId", "idempotencyKey");
CREATE INDEX "finance_ticket_pricing_revisions_requestId_createdAt_idx" ON "finance_ticket_pricing_revisions"("requestId", "createdAt");

ALTER TABLE "finance_ticket_pricing_requests" ADD CONSTRAINT "finance_ticket_pricing_requests_ticketOfferId_fkey" FOREIGN KEY ("ticketOfferId") REFERENCES "TicketPublishedOffer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_ticket_pricing_requests" ADD CONSTRAINT "finance_ticket_pricing_requests_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_ticket_pricing_requests" ADD CONSTRAINT "finance_ticket_pricing_requests_requestedByUserId_fkey" FOREIGN KEY ("requestedByUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_ticket_pricing_revisions" ADD CONSTRAINT "finance_ticket_pricing_revisions_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "finance_ticket_pricing_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "finance_ticket_pricing_revisions" ADD CONSTRAINT "finance_ticket_pricing_revisions_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "iam_permissions" ("id", "code", "module", "name", "createdAt") VALUES
  (gen_random_uuid(), 'finance.ticket_pricing.read', 'finance', 'مشاهده درخواست قیمت خرید بلیت', CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'finance.ticket_pricing.manage', 'finance', 'ثبت قیمت خرید بلیت', CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET "module" = EXCLUDED."module", "name" = EXCLUDED."name";

INSERT INTO "iam_role_permissions" ("roleId", "permissionId", "grantedAt")
SELECT r."id", p."id", CURRENT_TIMESTAMP
FROM "iam_roles" r
JOIN "iam_permissions" p ON p."code" IN ('finance.ticket_pricing.read', 'finance.ticket_pricing.manage')
WHERE r."code" IN ('administrator', 'finance_staff')
ON CONFLICT ("roleId", "permissionId") DO NOTHING;
