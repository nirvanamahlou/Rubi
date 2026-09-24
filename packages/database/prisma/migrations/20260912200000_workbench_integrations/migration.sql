ALTER TABLE "messaging_members"
  ADD COLUMN "last_read_at" TIMESTAMPTZ(3);

CREATE TABLE "workbench_note_folders" (
  "user_id" UUID NOT NULL,
  "name" VARCHAR(60) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "workbench_note_folders_pkey" PRIMARY KEY ("user_id", "name"),
  CONSTRAINT "workbench_note_folders_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "workbench_notes" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "body" VARCHAR(10000) NOT NULL DEFAULT '',
  "folder" VARCHAR(60) NOT NULL,
  "tags" VARCHAR(500) NOT NULL DEFAULT '',
  "items" JSONB NOT NULL,
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "reminder_at" TIMESTAMPTZ(3),
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "workbench_notes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workbench_notes_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workbench_notes_user_id_folder_fkey"
    FOREIGN KEY ("user_id", "folder") REFERENCES "workbench_note_folders"("user_id", "name") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "workbench_notes_version_check" CHECK ("version" > 0),
  CONSTRAINT "workbench_notes_items_check" CHECK (jsonb_typeof("items") = 'array')
);
CREATE INDEX "workbench_notes_user_id_pinned_updated_at_idx"
  ON "workbench_notes"("user_id", "pinned", "updated_at");
CREATE INDEX "workbench_notes_user_id_reminder_at_idx"
  ON "workbench_notes"("user_id", "reminder_at");

CREATE TABLE "workbench_calendar_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "user_id" UUID NOT NULL,
  "branch_id" UUID NOT NULL,
  "title" VARCHAR(120) NOT NULL,
  "description" VARCHAR(2000) NOT NULL DEFAULT '',
  "due_at" TIMESTAMPTZ(3) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PLANNED',
  "priority" VARCHAR(24) NOT NULL DEFAULT 'NORMAL',
  "link_url" VARCHAR(1000),
  "image_document_id" UUID,
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "workbench_calendar_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "workbench_calendar_events_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "workbench_calendar_events_branch_id_fkey"
    FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "workbench_calendar_events_image_document_id_fkey"
    FOREIGN KEY ("image_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "workbench_calendar_events_status_check"
    CHECK ("status" IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'CANCELLED')),
  CONSTRAINT "workbench_calendar_events_priority_check"
    CHECK ("priority" IN ('NORMAL', 'HIGH', 'URGENT')),
  CONSTRAINT "workbench_calendar_events_version_check" CHECK ("version" > 0)
);
CREATE INDEX "workbench_calendar_events_user_id_due_at_idx"
  ON "workbench_calendar_events"("user_id", "due_at");
CREATE INDEX "workbench_calendar_events_branch_id_due_at_idx"
  ON "workbench_calendar_events"("branch_id", "due_at");

CREATE TABLE "document_favorites" (
  "user_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "document_favorites_pkey" PRIMARY KEY ("user_id", "document_id"),
  CONSTRAINT "document_favorites_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "document_favorites_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX "document_favorites_document_id_idx"
  ON "document_favorites"("document_id");

CREATE TABLE "messaging_message_attachments" (
  "message_id" UUID NOT NULL,
  "document_id" UUID NOT NULL,
  "title" VARCHAR(240) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "messaging_message_attachments_pkey" PRIMARY KEY ("message_id", "document_id"),
  CONSTRAINT "messaging_message_attachments_message_id_fkey"
    FOREIGN KEY ("message_id") REFERENCES "messaging_messages"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "messaging_message_attachments_document_id_fkey"
    FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "messaging_message_attachments_document_id_idx"
  ON "messaging_message_attachments"("document_id");

CREATE TABLE "iam_user_profiles" (
  "user_id" UUID NOT NULL,
  "phone" VARCHAR(32),
  "photo_document_id" UUID,
  "updated_at" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "iam_user_profiles_pkey" PRIMARY KEY ("user_id"),
  CONSTRAINT "iam_user_profiles_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "iam_users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "iam_user_profiles_photo_document_id_fkey"
    FOREIGN KEY ("photo_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "iam_user_profiles_photo_document_id_idx"
  ON "iam_user_profiles"("photo_document_id");
