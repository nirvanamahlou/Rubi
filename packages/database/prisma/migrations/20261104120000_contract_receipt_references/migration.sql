-- Required by contract payment receipts even on installations without demo seeds.
-- Preserve existing IDs, custom policies and explicit deactivation.
SET lock_timeout = '5s';

INSERT INTO "document_categories" (
  "id", "code", "name", "is_active", "created_at", "updated_at"
)
VALUES (
  gen_random_uuid(), 'PROCUREMENT_FINANCE', 'خرید و مالی', true, now(), now()
)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "document_types" (
  "id", "code", "name", "domain", "default_confidentiality",
  "allowed_mime_types", "max_file_size_bytes", "requires_expiry",
  "is_active", "created_at", "updated_at"
)
VALUES (
  gen_random_uuid(), 'RECEIPT', 'رسید', 'FINANCE', 'RESTRICTED',
  ARRAY['application/pdf', 'image/jpeg', 'image/png'], 26214400, false,
  true, now(), now()
)
ON CONFLICT ("code") DO NOTHING;
