-- Required by manifest template uploads on installations without demo seeds.
SET lock_timeout = '5s';
INSERT INTO "document_categories" ("id", "code", "name", "is_active", "created_at", "updated_at")
VALUES (gen_random_uuid(), 'TRAVEL_RESERVATIONS', 'سفر و رزرواسیون', true, now(), now())
ON CONFLICT ("code") DO NOTHING;
INSERT INTO "document_types" (
 "id", "code", "name", "domain", "default_confidentiality", "allowed_mime_types",
 "max_file_size_bytes", "requires_expiry", "is_active", "created_at", "updated_at"
) VALUES (
 gen_random_uuid(), 'MANIFEST', 'Manifest', 'TRAVEL', 'INTERNAL',
 ARRAY['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
 26214400, false, true, now(), now()
) ON CONFLICT ("code") DO NOTHING;
