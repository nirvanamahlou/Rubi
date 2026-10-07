-- Additive Finance-owned groups, durable typed templates and prospective journal evidence.
CREATE UNIQUE INDEX "accounting_configurations_id_bookId_key" ON "accounting_configurations"("id", "bookId");
CREATE UNIQUE INDEX "accounting_periods_id_bookId_key" ON "accounting_periods"("id", "bookId");
CREATE UNIQUE INDEX "accounting_accounts_id_bookId_key" ON "accounting_accounts"("id", "bookId");
CREATE UNIQUE INDEX "accounting_details_id_bookId_key" ON "accounting_details"("id", "bookId");
CREATE UNIQUE INDEX "accounting_journals_id_bookId_key" ON "accounting_journals"("id", "bookId");
CREATE UNIQUE INDEX "accounting_commands_id_bookId_key" ON "accounting_commands"("id", "bookId");
CREATE UNIQUE INDEX "accounting_commands_id_bookId_actorId_key" ON "accounting_commands"("id", "bookId", "actorId");

CREATE TABLE "accounting_account_groups" (
  "id" UUID NOT NULL,
  "bookId" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "titleEn" VARCHAR(160),
  "description" VARCHAR(2000),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "accounting_account_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_account_groups_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "accounting_account_groups_bookId_code_key" ON "accounting_account_groups"("bookId", "code");
CREATE UNIQUE INDEX "accounting_account_groups_id_bookId_key" ON "accounting_account_groups"("id", "bookId");

CREATE TABLE "accounting_account_group_members" (
  "bookId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "accountId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_account_group_members_pkey" PRIMARY KEY ("groupId", "accountId"),
  CONSTRAINT "accounting_account_group_members_groupId_bookId_fkey" FOREIGN KEY ("groupId", "bookId") REFERENCES "accounting_account_groups"("id", "bookId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "accounting_account_group_members_accountId_bookId_fkey" FOREIGN KEY ("accountId", "bookId") REFERENCES "accounting_accounts"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "accounting_account_group_members_bookId_accountId_idx" ON "accounting_account_group_members"("bookId", "accountId");

CREATE TABLE "accounting_detail_groups" (
  "id" UUID NOT NULL,
  "bookId" UUID NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "titleEn" VARCHAR(160),
  "description" VARCHAR(2000),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "accounting_detail_groups_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_detail_groups_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "accounting_detail_groups_bookId_code_key" ON "accounting_detail_groups"("bookId", "code");
CREATE UNIQUE INDEX "accounting_detail_groups_id_bookId_key" ON "accounting_detail_groups"("id", "bookId");

CREATE TABLE "accounting_detail_group_members" (
  "bookId" UUID NOT NULL,
  "groupId" UUID NOT NULL,
  "detailId" UUID NOT NULL,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_detail_group_members_pkey" PRIMARY KEY ("groupId", "detailId"),
  CONSTRAINT "accounting_detail_group_members_groupId_bookId_fkey" FOREIGN KEY ("groupId", "bookId") REFERENCES "accounting_detail_groups"("id", "bookId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "accounting_detail_group_members_detailId_bookId_fkey" FOREIGN KEY ("detailId", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "accounting_detail_group_members_bookId_detailId_idx" ON "accounting_detail_group_members"("bookId", "detailId");

CREATE TABLE "accounting_templates" (
  "id" UUID NOT NULL,
  "bookId" UUID NOT NULL,
  "kind" VARCHAR(16) NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "titleEn" VARCHAR(160),
  "description" VARCHAR(2000),
  "descriptionEn" VARCHAR(2000),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "voucherTypeId" UUID,
  "gainAccountId" UUID,
  "lossAccountId" UUID,
  "retainedAccountId" UUID,
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "accounting_templates_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_templates_kind_check" CHECK ("kind" IN ('AUTOMATIC','REVALUATION','CLOSING')),
  CONSTRAINT "accounting_templates_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_templates_voucherTypeId_bookId_fkey" FOREIGN KEY ("voucherTypeId", "bookId") REFERENCES "accounting_configurations"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_templates_gainAccountId_bookId_fkey" FOREIGN KEY ("gainAccountId", "bookId") REFERENCES "accounting_accounts"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_templates_lossAccountId_bookId_fkey" FOREIGN KEY ("lossAccountId", "bookId") REFERENCES "accounting_accounts"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_templates_retainedAccountId_bookId_fkey" FOREIGN KEY ("retainedAccountId", "bookId") REFERENCES "accounting_accounts"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "accounting_templates_bookId_kind_code_key" ON "accounting_templates"("bookId", "kind", "code");
CREATE UNIQUE INDEX "accounting_templates_id_bookId_key" ON "accounting_templates"("id", "bookId");
CREATE INDEX "accounting_templates_bookId_kind_active_idx" ON "accounting_templates"("bookId", "kind", "active");

CREATE TABLE "accounting_template_lines" (
  "id" UUID NOT NULL,
  "bookId" UUID NOT NULL,
  "templateId" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  "accountId" UUID NOT NULL,
  "detail4Id" UUID,
  "detail5Id" UUID,
  "detail6Id" UUID,
  "side" VARCHAR(8) NOT NULL,
  "percentage" DECIMAL(20,8) NOT NULL,
  "include" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "accounting_template_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_template_lines_side_check" CHECK ("side" IN ('DEBIT','CREDIT')),
  CONSTRAINT "accounting_template_lines_percentage_check" CHECK ("percentage" > 0 AND "percentage" <= 100),
  CONSTRAINT "accounting_template_lines_templateId_bookId_fkey" FOREIGN KEY ("templateId", "bookId") REFERENCES "accounting_templates"("id", "bookId") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "accounting_template_lines_accountId_bookId_fkey" FOREIGN KEY ("accountId", "bookId") REFERENCES "accounting_accounts"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_template_lines_detail4Id_bookId_fkey" FOREIGN KEY ("detail4Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_template_lines_detail5Id_bookId_fkey" FOREIGN KEY ("detail5Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_template_lines_detail6Id_bookId_fkey" FOREIGN KEY ("detail6Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "accounting_template_lines_templateId_position_key" ON "accounting_template_lines"("templateId", "position");
CREATE INDEX "accounting_template_lines_bookId_accountId_idx" ON "accounting_template_lines"("bookId", "accountId");

CREATE TABLE "accounting_journal_state_events" (
  "id" UUID NOT NULL,
  "bookId" UUID NOT NULL,
  "journalId" UUID NOT NULL,
  "commandId" UUID NOT NULL,
  "actorId" UUID NOT NULL,
  "sequence" INTEGER NOT NULL,
  "eventType" VARCHAR(16) NOT NULL,
  "fromStatus" VARCHAR(24),
  "toStatus" VARCHAR(24),
  "journalVersion" INTEGER NOT NULL,
  "oldPeriodId" UUID,
  "newPeriodId" UUID,
  "oldDocumentDate" VARCHAR(10),
  "newDocumentDate" VARCHAR(10),
  "reason" VARCHAR(2000),
  "occurredAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accounting_journal_state_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accounting_journal_state_events_type_check" CHECK ("eventType" IN ('CREATE','STATUS','MOVE')),
  CONSTRAINT "accounting_journal_state_events_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_journal_state_events_journalId_bookId_fkey" FOREIGN KEY ("journalId", "bookId") REFERENCES "accounting_journals"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_journal_state_events_command_actor_fkey" FOREIGN KEY ("commandId", "bookId", "actorId") REFERENCES "accounting_commands"("id", "bookId", "actorId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_journal_state_events_oldPeriodId_bookId_fkey" FOREIGN KEY ("oldPeriodId", "bookId") REFERENCES "accounting_periods"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "accounting_journal_state_events_newPeriodId_bookId_fkey" FOREIGN KEY ("newPeriodId", "bookId") REFERENCES "accounting_periods"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "accounting_journal_state_events_bookId_journalId_occurredAt_id_idx" ON "accounting_journal_state_events"("bookId", "journalId", "occurredAt", "id");
CREATE INDEX "accounting_journal_state_events_bookId_commandId_idx" ON "accounting_journal_state_events"("bookId", "commandId");
CREATE UNIQUE INDEX "accounting_journal_state_events_commandId_sequence_key" ON "accounting_journal_state_events"("commandId", "sequence");
CREATE UNIQUE INDEX "accounting_journal_state_events_journalId_journalVersion_eventType_key" ON "accounting_journal_state_events"("journalId", "journalVersion", "eventType");

CREATE FUNCTION accounting_guard_state_event() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'accounting journal state events are immutable';
END $$;
CREATE TRIGGER accounting_journal_state_event_immutable BEFORE UPDATE OR DELETE ON accounting_journal_state_events
FOR EACH ROW EXECUTE FUNCTION accounting_guard_state_event();
