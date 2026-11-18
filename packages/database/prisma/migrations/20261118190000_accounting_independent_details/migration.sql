-- Additional independent detail dimensions. Existing rows retain their original values.

ALTER TABLE "accounting_journal_lines"
  ADD COLUMN "detail7Id" UUID,
  ADD COLUMN "detail8Id" UUID,
  ADD COLUMN "detail9Id" UUID,
  ADD COLUMN "detail10Id" UUID,
  ADD COLUMN "detail11Id" UUID,
  ADD COLUMN "detail12Id" UUID;

ALTER TABLE "accounting_journal_lines"
  ADD CONSTRAINT "accounting_journal_lines_detail7Id_fkey" FOREIGN KEY ("detail7Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_journal_lines_detail8Id_fkey" FOREIGN KEY ("detail8Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_journal_lines_detail9Id_fkey" FOREIGN KEY ("detail9Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_journal_lines_detail10Id_fkey" FOREIGN KEY ("detail10Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_journal_lines_detail11Id_fkey" FOREIGN KEY ("detail11Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_journal_lines_detail12Id_fkey" FOREIGN KEY ("detail12Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_template_lines"
  ADD COLUMN "detail7Id" UUID,
  ADD COLUMN "detail8Id" UUID,
  ADD COLUMN "detail9Id" UUID,
  ADD COLUMN "detail10Id" UUID,
  ADD COLUMN "detail11Id" UUID,
  ADD COLUMN "detail12Id" UUID;

ALTER TABLE "accounting_template_lines"
  ADD CONSTRAINT "accounting_template_lines_detail7Id_bookId_fkey" FOREIGN KEY ("detail7Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_template_lines_detail8Id_bookId_fkey" FOREIGN KEY ("detail8Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_template_lines_detail9Id_bookId_fkey" FOREIGN KEY ("detail9Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_template_lines_detail10Id_bookId_fkey" FOREIGN KEY ("detail10Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_template_lines_detail11Id_bookId_fkey" FOREIGN KEY ("detail11Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_template_lines_detail12Id_bookId_fkey" FOREIGN KEY ("detail12Id", "bookId") REFERENCES "accounting_details"("id", "bookId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_subsidiary_mappings"
  ADD COLUMN "detail7Id" UUID,
  ADD COLUMN "detail8Id" UUID,
  ADD COLUMN "detail9Id" UUID,
  ADD COLUMN "detail10Id" UUID,
  ADD COLUMN "detail11Id" UUID,
  ADD COLUMN "detail12Id" UUID,
  ADD COLUMN "sourceDetail7Id" UUID,
  ADD COLUMN "sourceDetail8Id" UUID,
  ADD COLUMN "sourceDetail9Id" UUID,
  ADD COLUMN "sourceDetail10Id" UUID,
  ADD COLUMN "sourceDetail11Id" UUID,
  ADD COLUMN "sourceDetail12Id" UUID;

ALTER TABLE "accounting_subsidiary_mappings"
  ADD CONSTRAINT "accounting_subsidiary_mappings_detail7Id_fkey" FOREIGN KEY ("detail7Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_detail8Id_fkey" FOREIGN KEY ("detail8Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_detail9Id_fkey" FOREIGN KEY ("detail9Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_detail10Id_fkey" FOREIGN KEY ("detail10Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_detail11Id_fkey" FOREIGN KEY ("detail11Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_detail12Id_fkey" FOREIGN KEY ("detail12Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_sourceDetail7Id_fkey" FOREIGN KEY ("sourceDetail7Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_sourceDetail8Id_fkey" FOREIGN KEY ("sourceDetail8Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_sourceDetail9Id_fkey" FOREIGN KEY ("sourceDetail9Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_sourceDetail10Id_fkey" FOREIGN KEY ("sourceDetail10Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_sourceDetail11Id_fkey" FOREIGN KEY ("sourceDetail11Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "accounting_subsidiary_mappings_sourceDetail12Id_fkey" FOREIGN KEY ("sourceDetail12Id") REFERENCES "accounting_details"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "accounting_subsidiary_mappings" ALTER COLUMN "sourceKey" TYPE VARCHAR(400);

-- A mapped dimension may be specified independently of all preceding dimensions.
ALTER TABLE "accounting_subsidiary_mappings" DROP CONSTRAINT "accounting_mapping_source_path_check";
