INSERT INTO "document_categories" ("id", "code", "name", "is_active", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'GENERAL_ARCHIVE', 'آرشیو عمومی', true, now(), now())
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "is_active" = true,
    "updated_at" = now();

INSERT INTO "document_types" (
  "id",
  "code",
  "name",
  "domain",
  "default_confidentiality",
  "allowed_mime_types",
  "max_file_size_bytes",
  "requires_expiry",
  "is_active",
  "created_at",
  "updated_at"
)
VALUES (
  gen_random_uuid(),
  'WORKBENCH_FEEDBACK_ATTACHMENT',
  'پیوست نظرسنجی',
  'GENERAL',
  'INTERNAL',
  ARRAY['application/pdf', 'image/png', 'image/jpeg'],
  10485760,
  false,
  true,
  now(),
  now()
)
ON CONFLICT ("code") DO UPDATE
SET "name" = EXCLUDED."name",
    "domain" = EXCLUDED."domain",
    "default_confidentiality" = EXCLUDED."default_confidentiality",
    "allowed_mime_types" = EXCLUDED."allowed_mime_types",
    "max_file_size_bytes" = EXCLUDED."max_file_size_bytes",
    "requires_expiry" = false,
    "is_active" = true,
    "updated_at" = now();
