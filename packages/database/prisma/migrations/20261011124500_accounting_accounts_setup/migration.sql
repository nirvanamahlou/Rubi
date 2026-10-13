-- AlterTable
ALTER TABLE "accounting_account_groups" ADD COLUMN     "notes" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "accounting_detail_groups" ADD COLUMN     "notes" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "accounting_subsidiary_mappings" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "sourceAccountId" UUID NOT NULL,
    "targetAccountId" UUID NOT NULL,
    "detail4Id" UUID,
    "detail5Id" UUID,
    "detail6Id" UUID,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "accounting_subsidiary_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounting_detail_type_conversions" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "userTypeId" UUID NOT NULL,
    "systemTypeId" UUID NOT NULL,
    "entity" VARCHAR(80) NOT NULL,
    "date" VARCHAR(10) NOT NULL,
    "description" VARCHAR(2000),
    "state" VARCHAR(16) NOT NULL DEFAULT 'REGISTERED',
    "notes" JSONB NOT NULL DEFAULT '[]',
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "accounting_detail_type_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_subsidiary_mappings_sourceAccountId_key" ON "accounting_subsidiary_mappings"("sourceAccountId");

-- CreateIndex
CREATE INDEX "accounting_subsidiary_mappings_bookId_idx" ON "accounting_subsidiary_mappings"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "accounting_detail_type_conversions_bookId_userTypeId_key" ON "accounting_detail_type_conversions"("bookId", "userTypeId");

-- AddForeignKey
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_subsidiary_mappings_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_subsidiary_mappings_sourceAccountId_fkey" FOREIGN KEY ("sourceAccountId") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_subsidiary_mappings_targetAccountId_fkey" FOREIGN KEY ("targetAccountId") REFERENCES "accounting_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_subsidiary_mappings_detail4Id_fkey" FOREIGN KEY ("detail4Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_subsidiary_mappings_detail5Id_fkey" FOREIGN KEY ("detail5Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_subsidiary_mappings_detail6Id_fkey" FOREIGN KEY ("detail6Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_detail_type_conversions" ADD CONSTRAINT "accounting_detail_type_conversions_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "accounting_books"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_detail_type_conversions" ADD CONSTRAINT "accounting_detail_type_conversions_userTypeId_fkey" FOREIGN KEY ("userTypeId") REFERENCES "accounting_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_detail_type_conversions" ADD CONSTRAINT "accounting_detail_type_conversions_systemTypeId_fkey" FOREIGN KEY ("systemTypeId") REFERENCES "accounting_configurations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Keep setup references within the owning book even for direct SQL clients.
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_mapping_source_book_fk" FOREIGN KEY ("sourceAccountId", "bookId") REFERENCES "accounting_accounts"("id", "bookId") ON DELETE RESTRICT;
ALTER TABLE "accounting_detail_type_conversions" ADD CONSTRAINT "accounting_conversion_user_book_fk" FOREIGN KEY ("userTypeId", "bookId") REFERENCES "accounting_configurations"("id", "bookId") ON DELETE RESTRICT;
ALTER TABLE "accounting_detail_type_conversions" ADD CONSTRAINT "accounting_conversion_system_book_fk" FOREIGN KEY ("systemTypeId", "bookId") REFERENCES "accounting_configurations"("id", "bookId") ON DELETE RESTRICT;
ALTER TABLE "accounting_detail_type_conversions" ADD CONSTRAINT "accounting_conversion_state_check" CHECK ("state" IN ('REGISTERED','CONVERTED') AND "userTypeId" <> "systemTypeId");
