-- CreateTable
CREATE TABLE "accounting_books" (
    "id" UUID NOT NULL,
    "branchId" UUID NOT NULL,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "baseCurrency" VARCHAR(3) NOT NULL,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "allowsPosting" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "nextNumber" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounting_books_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_configurations" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "code" VARCHAR(40) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "titleEn" VARCHAR(160),
    "description" VARCHAR(2000),
    "attributes" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounting_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_periods" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "fiscalYearId" UUID NOT NULL,
    "startDate" VARCHAR(10) NOT NULL,
    "endDate" VARCHAR(10) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "accounting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_accounts" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "parentId" UUID,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "titleEn" VARCHAR(160),
    "level" VARCHAR(16) NOT NULL,
    "nature" VARCHAR(8) NOT NULL,
    "permanent" BOOLEAN NOT NULL DEFAULT true,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "attributes" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "accounting_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_details" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "typeId" UUID NOT NULL,
    "parentId" UUID,
    "code" VARCHAR(20) NOT NULL,
    "title" VARCHAR(160) NOT NULL,
    "currency" VARCHAR(3),
    "attributes" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "accounting_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_journals" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "periodId" UUID,
    "typeId" UUID,
    "documentDate" VARCHAR(10),
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "reference" VARCHAR(160),
    "status" VARCHAR(24) NOT NULL DEFAULT 'DRAFT',
    "number" INTEGER,
    "makerId" UUID NOT NULL,
    "approverId" UUID,
    "postedAt" TIMESTAMPTZ(3),
    "sourceKey" VARCHAR(200),
    "reversalOfId" UUID,
    "attributes" JSONB NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "accounting_journals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_journal_lines" (
    "id" UUID NOT NULL,
    "journalId" UUID NOT NULL,
    "position" INTEGER NOT NULL,
    "accountId" UUID,
    "detail4Id" UUID,
    "detail5Id" UUID,
    "detail6Id" UUID,
    "description" VARCHAR(2000) NOT NULL DEFAULT '',
    "debit" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "credit" DECIMAL(38,18) NOT NULL DEFAULT 0,
    "currency" VARCHAR(3),
    "foreignAmount" DECIMAL(38,18),
    "rate" DECIMAL(38,18),
    "attributes" JSONB NOT NULL,

    CONSTRAINT "accounting_journal_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_commands" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "key" VARCHAR(100) NOT NULL,
    "hash" VARCHAR(64) NOT NULL,
    "action" VARCHAR(80) NOT NULL,
    "result" JSONB NOT NULL,
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "accounting_commands_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_books_branchId_code_key" ON "accounting_books"("branchId", "code");

-- CreateIndex
CREATE INDEX "accounting_configurations_bookId_kind_active_idx" ON "accounting_configurations"("bookId", "kind", "active");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_configurations_bookId_kind_code_key" ON "accounting_configurations"("bookId", "kind", "code");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_periods_bookId_fiscalYearId_key" ON "accounting_periods"("bookId", "fiscalYearId");

-- CreateIndex
CREATE INDEX "accounting_accounts_bookId_parentId_idx" ON "accounting_accounts"("bookId", "parentId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_accounts_bookId_code_key" ON "accounting_accounts"("bookId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_details_bookId_code_key" ON "accounting_details"("bookId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_journals_reversalOfId_key" ON "accounting_journals"("reversalOfId");

-- CreateIndex
CREATE INDEX "accounting_journals_bookId_periodId_documentDate_status_idx" ON "accounting_journals"("bookId", "periodId", "documentDate", "status");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_journals_bookId_number_key" ON "accounting_journals"("bookId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_journals_bookId_sourceKey_key" ON "accounting_journals"("bookId", "sourceKey");

-- CreateIndex
CREATE INDEX "accounting_journal_lines_accountId_idx" ON "accounting_journal_lines"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_journal_lines_journalId_position_key" ON "accounting_journal_lines"("journalId", "position");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_commands_bookId_key_key" ON "accounting_commands"("bookId", "key");

-- AddForeignKey
ALTER TABLE "accounting_books" ADD CONSTRAINT "accounting_books_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_configurations" ADD CONSTRAINT "accounting_configurations_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_periods" ADD CONSTRAINT "accounting_periods_fiscalYearId_fkey" FOREIGN KEY ("fiscalYearId") REFERENCES "accounting_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_accounts" ADD CONSTRAINT "accounting_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_details" ADD CONSTRAINT "accounting_details_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_details" ADD CONSTRAINT "accounting_details_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "accounting_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_details" ADD CONSTRAINT "accounting_details_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journals" ADD CONSTRAINT "accounting_journals_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journals" ADD CONSTRAINT "accounting_journals_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "accounting_periods"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journals" ADD CONSTRAINT "accounting_journals_typeId_fkey" FOREIGN KEY ("typeId") REFERENCES "accounting_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journals" ADD CONSTRAINT "accounting_journals_makerId_fkey" FOREIGN KEY ("makerId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journals" ADD CONSTRAINT "accounting_journals_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journals" ADD CONSTRAINT "accounting_journals_reversalOfId_fkey" FOREIGN KEY ("reversalOfId") REFERENCES "accounting_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_journalId_fkey" FOREIGN KEY ("journalId") REFERENCES "accounting_journals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_detail4Id_fkey" FOREIGN KEY ("detail4Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_detail5Id_fkey" FOREIGN KEY ("detail5Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_journal_lines" ADD CONSTRAINT "accounting_journal_lines_detail6Id_fkey" FOREIGN KEY ("detail6Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_commands" ADD CONSTRAINT "accounting_commands_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_commands" ADD CONSTRAINT "accounting_commands_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "iam_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Defense in depth: posted effects and command audit cannot be rewritten.
CREATE FUNCTION accounting_guard_posted_journal() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.status = 'POSTED' THEN RAISE EXCEPTION 'posted accounting journal is immutable'; END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER accounting_journal_immutable BEFORE UPDATE OR DELETE ON accounting_journals
FOR EACH ROW EXECUTE FUNCTION accounting_guard_posted_journal();
CREATE FUNCTION accounting_guard_posted_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    IF EXISTS(SELECT 1 FROM accounting_journals WHERE id=OLD."journalId" AND status='POSTED') THEN
      RAISE EXCEPTION 'posted accounting lines are immutable';
    END IF;
  END IF;
  IF TG_OP <> 'DELETE' THEN
    IF EXISTS(SELECT 1 FROM accounting_journals WHERE id=NEW."journalId" AND status='POSTED') THEN
      RAISE EXCEPTION 'posted accounting lines are immutable';
    END IF;
    RETURN NEW;
  END IF;
  RETURN OLD;
END $$;
CREATE TRIGGER accounting_line_immutable BEFORE INSERT OR UPDATE OR DELETE ON accounting_journal_lines
FOR EACH ROW EXECUTE FUNCTION accounting_guard_posted_line();
ALTER TABLE accounting_journal_lines ADD CONSTRAINT accounting_nonnegative_amounts CHECK (debit>=0 AND credit>=0 AND ("foreignAmount" IS NULL OR "foreignAmount">=0) AND (rate IS NULL OR rate>0));
ALTER TABLE accounting_periods ADD CONSTRAINT accounting_period_dates CHECK ("startDate" <= "endDate");
ALTER TABLE accounting_accounts ADD CONSTRAINT accounting_chart_level CHECK (level IN ('GROUP','GENERAL','SUBSIDIARY') AND nature IN ('DEBIT','CREDIT'));
ALTER TABLE accounting_journals ADD CONSTRAINT accounting_journal_status CHECK (status IN ('DRAFT','PENDING_APPROVAL','APPROVED','POSTED','CANCELLED'));
ALTER TABLE accounting_journals ADD CONSTRAINT accounting_journal_checker CHECK (status NOT IN ('APPROVED','POSTED') OR ("approverId" IS NOT NULL AND "approverId"<>"makerId"));
