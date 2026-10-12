-- Additive source-form roles; legacy side/percentage semantics and FKs are preserved.
ALTER TABLE "accounting_templates" ADD COLUMN "attributes" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "accounting_template_lines" ADD COLUMN "role" VARCHAR(8);
ALTER TABLE "accounting_template_lines" ADD CONSTRAINT "accounting_template_lines_role_check"
  CHECK ("role" IS NULL OR "role" IN ('SOURCE', 'TARGET', 'OFFSET', 'BASIS'));
