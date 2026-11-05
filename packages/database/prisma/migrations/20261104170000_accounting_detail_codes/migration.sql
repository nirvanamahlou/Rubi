BEGIN;

CREATE UNIQUE INDEX "accounting_details_bookId_typeId_code_key"
  ON accounting_details ("bookId", "typeId", code);
DROP INDEX "accounting_details_bookId_code_key";
ALTER TABLE accounting_details ADD COLUMN "customerId" uuid REFERENCES customers(id) ON DELETE RESTRICT ON UPDATE CASCADE;

-- Preserve historical codes verbatim when moving from optional/zero width.
UPDATE accounting_configurations c
SET attributes = jsonb_set(c.attributes, '{classificationNumberLength}', to_jsonb(greatest(6,
  length(c.attributes->>'defaultFirstCode'),
  (SELECT max(length(d.code)) FROM accounting_details d WHERE d."typeId" = c.id))::text)),
  version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE kind = 'detail-types' AND coalesce(attributes->>'classificationNumberLength','') !~ '^([1-9]|1[0-9]|20)$';

UPDATE accounting_configurations SET attributes = attributes || '{"isSystem":true}', active = true,
  version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
WHERE kind = 'detail-types' AND title IN ('شخص','شرکت') AND (attributes->>'isSystem' IS DISTINCT FROM 'true' OR NOT active);

INSERT INTO accounting_configurations (id,"bookId",kind,code,title,attributes,"updatedAt")
SELECT gen_random_uuid(), b.id, 'detail-types', 'DT-' || gen_random_uuid()::text, t.title,
  '{"isSystem":true,"classificationNumberLength":"6"}', CURRENT_TIMESTAMP
FROM accounting_books b CROSS JOIN (VALUES ('شخص'),('شرکت')) AS t(title)
WHERE NOT EXISTS (SELECT 1 FROM accounting_configurations c WHERE c."bookId"=b.id AND c.kind='detail-types' AND c.title=t.title);

-- Do not silently merge existing duplicate definitions or rewrite their FK references.
CREATE UNIQUE INDEX accounting_detail_type_title_key ON accounting_configurations
("bookId", lower(btrim(regexp_replace(translate(title, 'يك‌', 'یک '), '[[:space:]]+', ' ', 'g')))) WHERE kind='detail-types';

COMMIT;
