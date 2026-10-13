CREATE TABLE "ReservationWorkflowRevision" (
 "id" UUID NOT NULL, "intakeId" UUID NOT NULL, "version" INTEGER NOT NULL CHECK ("version" > 0),
 "state" JSONB NOT NULL, "actorUserId" UUID NOT NULL, "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "ReservationWorkflowRevision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "ReservationWorkflowRevision_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ReservationIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "ReservationWorkflowRevision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "ReservationWorkflowRevision_intakeId_version_key" ON "ReservationWorkflowRevision"("intakeId", "version");
CREATE TABLE "FinanceDeliveryRevision" (
 "id" UUID NOT NULL, "intakeId" UUID NOT NULL, "version" INTEGER NOT NULL CHECK ("version" > 0),
 "approved" BOOLEAN NOT NULL, "reason" VARCHAR(500) NOT NULL, "actorUserId" UUID NOT NULL,
 "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CONSTRAINT "FinanceDeliveryRevision_pkey" PRIMARY KEY ("id"),
 CONSTRAINT "FinanceDeliveryRevision_intakeId_fkey" FOREIGN KEY ("intakeId") REFERENCES "ReservationIntake"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "FinanceDeliveryRevision_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "FinanceDeliveryRevision_intakeId_version_key" ON "FinanceDeliveryRevision"("intakeId", "version");

ALTER TABLE "ReservationIntake" ADD COLUMN "salesOwnerUserId" UUID;
ALTER TABLE "ReservationIntake" ADD CONSTRAINT "ReservationIntake_salesOwnerUserId_fkey" FOREIGN KEY ("salesOwnerUserId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
-- One-time public handoff metadata backfill; no Sales data is changed.
UPDATE "ReservationIntake" r SET "salesOwnerUserId" = s."owner_user_id" FROM "sales_contracts" s WHERE s."id" = r."contractId";

-- Catalog only. Role membership/privileges are deliberately not changed by migration.
INSERT INTO "iam_permissions" ("id", "code", "module", "name") VALUES
(gen_random_uuid(), 'reservations.documents.manage', 'reservations', 'عملیات مدارک رزرواسیون'),
(gen_random_uuid(), 'finance.financial_release.read', 'finance', 'مشاهده مجوز تحویل مدارک'),
(gen_random_uuid(), 'finance.financial_release.approve', 'finance', 'تأیید یا لغو تحویل مدارک')
ON CONFLICT ("code") DO NOTHING;
