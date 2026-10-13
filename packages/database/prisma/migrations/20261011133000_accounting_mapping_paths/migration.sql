-- DropIndex
DROP INDEX "accounting_subsidiary_mappings_sourceAccountId_key";

-- AlterTable
ALTER TABLE "accounting_subsidiary_mappings" ADD COLUMN     "sourceDetail4Id" UUID,
ADD COLUMN     "sourceDetail5Id" UUID,
ADD COLUMN     "sourceDetail6Id" UUID,
ADD COLUMN     "sourceKey" VARCHAR(160);
UPDATE "accounting_subsidiary_mappings" SET "sourceKey" = "sourceAccountId"::text || ':::';
ALTER TABLE "accounting_subsidiary_mappings" ALTER COLUMN "sourceKey" SET NOT NULL;

-- CreateTable
CREATE TABLE "accounting_account_group_details" (
    "bookId" UUID NOT NULL,
    "groupId" UUID NOT NULL,
    "accountId" UUID NOT NULL,
    "detailId" UUID NOT NULL,

    CONSTRAINT "accounting_account_group_details_pkey" PRIMARY KEY ("groupId","accountId","detailId")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounting_subsidiary_mappings_sourceKey_key" ON "accounting_subsidiary_mappings"("sourceKey");

-- AddForeignKey
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_subsidiary_mappings_sourceDetail4Id_fkey" FOREIGN KEY ("sourceDetail4Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_subsidiary_mappings_sourceDetail5Id_fkey" FOREIGN KEY ("sourceDetail5Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_subsidiary_mappings_sourceDetail6Id_fkey" FOREIGN KEY ("sourceDetail6Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_account_group_details" ADD CONSTRAINT "accounting_account_group_details_groupId_bookId_fkey" FOREIGN KEY ("groupId", "bookId") REFERENCES "accounting_account_groups"("id", "bookId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_account_group_details" ADD CONSTRAINT "accounting_account_group_details_accountId_bookId_fkey" FOREIGN KEY ("accountId", "bookId") REFERENCES "accounting_accounts"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounting_account_group_details" ADD CONSTRAINT "accounting_account_group_details_detailId_bookId_fkey" FOREIGN KEY ("detailId", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_mapping_source_path_check" CHECK (("sourceDetail5Id" IS NULL OR "sourceDetail4Id" IS NOT NULL) AND ("sourceDetail6Id" IS NULL OR "sourceDetail5Id" IS NOT NULL));
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_mapping_source4_book_fkey" FOREIGN KEY ("sourceDetail4Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT;
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_mapping_source5_book_fkey" FOREIGN KEY ("sourceDetail5Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT;
ALTER TABLE "accounting_subsidiary_mappings" ADD CONSTRAINT "accounting_mapping_source6_book_fkey" FOREIGN KEY ("sourceDetail6Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT;
