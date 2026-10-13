-- CreateTable
CREATE TABLE "hr_employees" (
    "photo_document_id" UUID,
    "id" UUID NOT NULL,
    "personnel_code" VARCHAR(50) NOT NULL,
    "branch_id" UUID NOT NULL,
    "user_id" UUID,
    "manager_id" UUID,
    "name" VARCHAR(160) NOT NULL,
    "kind" VARCHAR(80) NOT NULL,
    "unit" VARCHAR(160) NOT NULL,
    "position" VARCHAR(160) NOT NULL,
    "grade" VARCHAR(40) NOT NULL,
    "started_at" DATE NOT NULL,
    "status" VARCHAR(80) NOT NULL DEFAULT 'فعال',
    "version" INTEGER NOT NULL DEFAULT 1,
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hr_employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_records" (
    "search_text" VARCHAR(12000) NOT NULL DEFAULT '',
    "expires_at" DATE,
    "document_id" UUID,
    "id" UUID NOT NULL,
    "code" VARCHAR(60) NOT NULL,
    "branch_id" UUID NOT NULL,
    "employee_id" UUID,
    "parent_id" UUID,
    "section" VARCHAR(40) NOT NULL,
    "tab" VARCHAR(40) NOT NULL,
    "values" JSONB NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(80) NOT NULL DEFAULT 'پیش‌نویس',
    "version" INTEGER NOT NULL DEFAULT 1,
    "effective_at" DATE,
    "applied_at" TIMESTAMPTZ(3),
    "deleted_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "hr_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_record_amounts" (
    "id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "field" VARCHAR(40) NOT NULL,
    "amount" DECIMAL(24,4) NOT NULL,
    "currency" VARCHAR(3) NOT NULL,

    CONSTRAINT "hr_record_amounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_audit_events" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "employee_id" UUID,
    "record_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "version" INTEGER,
    "from_status" VARCHAR(80),
    "to_status" VARCHAR(80),
    "changes" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_audit_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_commands" (
    "id" UUID NOT NULL,
    "actor_id" UUID NOT NULL,
    "key" VARCHAR(120) NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "result" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_commands_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_leave_entries" (
    "id" UUID NOT NULL,
    "employee_id" UUID NOT NULL,
    "record_id" UUID NOT NULL,
    "type" VARCHAR(80) NOT NULL,
    "days" DECIMAL(8,2) NOT NULL,
    "year" INTEGER NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_leave_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_notifications" (
    "id" UUID NOT NULL,
    "branch_id" UUID NOT NULL,
    "target_user_id" UUID,
    "employee_id" UUID,
    "record_id" UUID,
    "action" VARCHAR(80) NOT NULL,
    "title" VARCHAR(250) NOT NULL,
    "sensitive" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hr_notification_reads" (
    "notification_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "read_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hr_notification_reads_pkey" PRIMARY KEY ("notification_id","user_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_personnel_code_key" ON "hr_employees"("personnel_code");

-- CreateIndex
CREATE UNIQUE INDEX "hr_employees_user_id_key" ON "hr_employees"("user_id");

-- CreateIndex
CREATE INDEX "hr_employees_branch_id_deleted_at_name_idx" ON "hr_employees"("branch_id", "deleted_at", "name");

-- CreateIndex
CREATE INDEX "hr_employees_manager_id_idx" ON "hr_employees"("manager_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_records_code_key" ON "hr_records"("code");

-- CreateIndex
CREATE INDEX "hr_records_branch_id_section_tab_deleted_at_created_at_idx" ON "hr_records"("branch_id", "section", "tab", "deleted_at", "created_at");

-- CreateIndex
CREATE INDEX "hr_records_employee_id_section_tab_idx" ON "hr_records"("employee_id", "section", "tab");

-- CreateIndex
CREATE INDEX "hr_records_parent_id_branch_id_idx" ON "hr_records"("parent_id", "branch_id");

-- CreateIndex
CREATE INDEX "hr_records_effective_at_applied_at_idx" ON "hr_records"("effective_at", "applied_at");

-- CreateIndex
CREATE UNIQUE INDEX "hr_records_id_branch_id_key" ON "hr_records"("id", "branch_id");

-- CreateIndex
CREATE UNIQUE INDEX "hr_record_amounts_record_id_field_key" ON "hr_record_amounts"("record_id", "field");

-- CreateIndex
CREATE INDEX "hr_audit_events_branch_id_created_at_idx" ON "hr_audit_events"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "hr_audit_events_actor_id_idx" ON "hr_audit_events"("actor_id");

-- CreateIndex
CREATE INDEX "hr_audit_events_employee_id_created_at_idx" ON "hr_audit_events"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "hr_audit_events_record_id_created_at_idx" ON "hr_audit_events"("record_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "hr_commands_actor_id_key_key" ON "hr_commands"("actor_id", "key");

-- CreateIndex
CREATE INDEX "hr_leave_entries_employee_id_type_year_idx" ON "hr_leave_entries"("employee_id", "type", "year");

-- CreateIndex
CREATE UNIQUE INDEX "hr_leave_entries_record_id_action_key" ON "hr_leave_entries"("record_id", "action");

-- CreateIndex
CREATE INDEX "hr_notifications_branch_id_created_at_idx" ON "hr_notifications"("branch_id", "created_at");

-- CreateIndex
CREATE INDEX "hr_notifications_target_user_id_created_at_idx" ON "hr_notifications"("target_user_id", "created_at");

-- CreateIndex
CREATE INDEX "hr_notifications_employee_id_idx" ON "hr_notifications"("employee_id");

-- CreateIndex
CREATE INDEX "hr_notifications_record_id_idx" ON "hr_notifications"("record_id");

-- CreateIndex
CREATE INDEX "hr_notification_reads_user_id_idx" ON "hr_notification_reads"("user_id");

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_photo_document_id_fkey" FOREIGN KEY ("photo_document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_employees" ADD CONSTRAINT "hr_employees_manager_id_fkey" FOREIGN KEY ("manager_id") REFERENCES "hr_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_records" ADD CONSTRAINT "hr_records_parent_id_branch_id_fkey" FOREIGN KEY ("parent_id", "branch_id") REFERENCES "hr_records"("id", "branch_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_record_amounts" ADD CONSTRAINT "hr_record_amounts_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_audit_events" ADD CONSTRAINT "hr_audit_events_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_audit_events" ADD CONSTRAINT "hr_audit_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_audit_events" ADD CONSTRAINT "hr_audit_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_audit_events" ADD CONSTRAINT "hr_audit_events_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_commands" ADD CONSTRAINT "hr_commands_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_entries" ADD CONSTRAINT "hr_leave_entries_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_leave_entries" ADD CONSTRAINT "hr_leave_entries_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_notifications" ADD CONSTRAINT "hr_notifications_branch_id_fkey" FOREIGN KEY ("branch_id") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_notifications" ADD CONSTRAINT "hr_notifications_target_user_id_fkey" FOREIGN KEY ("target_user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_notifications" ADD CONSTRAINT "hr_notifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "hr_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_notifications" ADD CONSTRAINT "hr_notifications_record_id_fkey" FOREIGN KEY ("record_id") REFERENCES "hr_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_notification_reads" ADD CONSTRAINT "hr_notification_reads_notification_id_fkey" FOREIGN KEY ("notification_id") REFERENCES "hr_notifications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hr_notification_reads" ADD CONSTRAINT "hr_notification_reads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Domain integrity beyond Prisma's declarative constraints.
ALTER TABLE hr_employees ADD CONSTRAINT hr_employees_version_positive CHECK (version > 0);
ALTER TABLE hr_employees ADD CONSTRAINT hr_employees_manager_not_self CHECK (manager_id IS NULL OR manager_id <> id);
ALTER TABLE hr_records ADD CONSTRAINT hr_records_version_positive CHECK (version > 0);
ALTER TABLE hr_records ADD CONSTRAINT hr_records_parent_not_self CHECK (parent_id IS NULL OR parent_id <> id);
ALTER TABLE hr_records ADD CONSTRAINT hr_records_values_bounded CHECK (jsonb_typeof("values") = 'array' AND jsonb_array_length("values") <= 24 AND octet_length("values"::text) <= 32000);
ALTER TABLE hr_records ADD CONSTRAINT hr_records_data_bounded CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 8000);
ALTER TABLE hr_record_amounts ADD CONSTRAINT hr_record_amounts_nonnegative CHECK (amount >= 0 AND currency ~ '^[A-Z]{3}$');
ALTER TABLE hr_leave_entries ADD CONSTRAINT hr_leave_entries_direction CHECK ((action IN ('GRANT','REVERSE') AND days > 0) OR (action = 'CONSUME' AND days < 0));
ALTER TABLE hr_leave_entries ADD CONSTRAINT hr_leave_entries_year CHECK (year BETWEEN 2000 AND 2200);
CREATE UNIQUE INDEX hr_records_approved_job_effect_unique ON hr_records(employee_id, effective_at) WHERE section = 'lifecycle' AND tab IN ('promotion','transfer','separation') AND status IN ('تأییدشده','تاییدشده','فعال','آماده شروع') AND deleted_at IS NULL;
CREATE INDEX hr_employees_photo_document_id_idx ON hr_employees(photo_document_id);
CREATE INDEX hr_records_document_id_idx ON hr_records(document_id);
CREATE INDEX hr_records_business_date_idx ON hr_records(branch_id, section, tab, effective_at) WHERE deleted_at IS NULL;

CREATE FUNCTION hr_reject_history_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'HR history is append-only' USING ERRCODE = '23514';
END;
$$;
CREATE TRIGGER hr_audit_immutable BEFORE UPDATE OR DELETE ON hr_audit_events FOR EACH ROW EXECUTE FUNCTION hr_reject_history_mutation();
CREATE TRIGGER hr_leave_ledger_immutable BEFORE UPDATE OR DELETE ON hr_leave_entries FOR EACH ROW EXECUTE FUNCTION hr_reject_history_mutation();
CREATE TRIGGER hr_commands_immutable BEFORE UPDATE OR DELETE ON hr_commands FOR EACH ROW EXECUTE FUNCTION hr_reject_history_mutation();

CREATE INDEX hr_records_expiry_idx ON hr_records(branch_id, section, tab, expires_at) WHERE deleted_at IS NULL;
