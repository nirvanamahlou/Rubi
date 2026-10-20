BEGIN;
CREATE TABLE "customer_affairs_call_contacts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "branch_id" UUID NOT NULL,
  "phone_fingerprint" CHAR(64) NOT NULL,
  "latest_occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_affairs_call_contacts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_contact_branch_fk" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "call_contact_phone_key" ON "customer_affairs_call_contacts"("branch_id", "phone_fingerprint");
CREATE INDEX "call_contact_recent_idx" ON "customer_affairs_call_contacts"("branch_id", "latest_occurred_at", "id");
CREATE TABLE "customer_affairs_calls" (
  "id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "direction" VARCHAR(8) NOT NULL,
  "status" VARCHAR(40) NOT NULL,
  "occurred_at" TIMESTAMPTZ(3) NOT NULL,
  "encrypted_payload" TEXT NOT NULL,
  "key_version" INTEGER NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_affairs_calls_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_contact_fk" FOREIGN KEY ("contact_id") REFERENCES "customer_affairs_call_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "call_creator_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "call_direction_check" CHECK ("direction" IN ('INBOUND','OUTBOUND')),
  CONSTRAINT "call_status_check" CHECK ("status" IN ('جدید','پیگیری اول','پیگیری دوم','پیگیری سوم','منتظر تماس مجدد','بدون پاسخ','نهایی شده')),
  CONSTRAINT "call_key_version_check" CHECK ("key_version" > 0)
);
CREATE INDEX "call_contact_calls_idx" ON "customer_affairs_calls"("contact_id", "occurred_at", "id");
CREATE TABLE "customer_affairs_call_notes" (
  "id" UUID NOT NULL,
  "contact_id" UUID NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "encrypted_payload" TEXT NOT NULL,
  "key_version" INTEGER NOT NULL,
  "request_fingerprint" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "customer_affairs_call_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "call_note_contact_fk" FOREIGN KEY ("contact_id") REFERENCES "customer_affairs_call_contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "call_note_creator_fk" FOREIGN KEY ("created_by_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "call_note_key_version_check" CHECK ("key_version" > 0)
);
CREATE INDEX "call_contact_notes_idx" ON "customer_affairs_call_notes"("contact_id", "created_at", "id");
COMMIT;
