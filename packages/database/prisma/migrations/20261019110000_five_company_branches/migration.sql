-- FIVE-BRANCH-COMPANY-1019: owner explicitly authorizes all existing users in all five branches.
-- Data only. Preserve existing FK identities, extra branches, primary scopes and operational permissions.
BEGIN;
LOCK TABLE branches, iam_users, iam_user_branches, legal_entities IN SHARE ROW EXCLUSIVE MODE;
DO $$
DECLARE item RECORD; existing_id UUID; matches INTEGER;
BEGIN
  FOR item IN SELECT * FROM (VALUES
    ('HQ', 'دفتر مرکزی'),
    ('NIYAYESH_SEIR_SAHAR', 'نیایش سیر سحر'),
    ('JAHAN_BASTAN', 'جهان باستان'),
    ('GHESATI_RO', 'قسطی رو'),
    ('JAHAN_ACADEMIA', 'جهان آکادمی')
  ) AS v(code, name) LOOP
    SELECT id INTO existing_id FROM branches WHERE code = item.code;
    IF existing_id IS NULL THEN
      SELECT count(*), (array_agg(id))[1] INTO matches, existing_id FROM branches
        WHERE regexp_replace(translate(name, 'يك', 'یک'), '^(شرکت\s+)|\s', '', 'g') =
          regexp_replace(item.name, '\s', '', 'g');
      IF matches > 1 THEN RAISE EXCEPTION 'Ambiguous existing branch for code %', item.code; END IF;
      IF existing_id IS NULL THEN
        INSERT INTO branches (id, code, name, "updatedAt")
          VALUES (gen_random_uuid(), item.code, item.name, CURRENT_TIMESTAMP);
      ELSE
        UPDATE branches SET code = item.code, "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE id = existing_id;
      END IF;
    ELSE
      UPDATE branches SET "isActive" = true, "updatedAt" = CURRENT_TIMESTAMP WHERE id = existing_id AND NOT "isActive";
    END IF;
  END LOOP;
END $$;

WITH added AS (
  INSERT INTO iam_user_branches ("userId", "branchId", "isPrimary")
    SELECT u.id, b.id, b.code = 'HQ' AND NOT EXISTS (
      SELECT 1 FROM iam_user_branches p WHERE p."userId" = u.id AND p."isPrimary"
    ) FROM iam_users u CROSS JOIN branches b
    WHERE b.code IN ('HQ', 'NIYAYESH_SEIR_SAHAR', 'JAHAN_BASTAN', 'GHESATI_RO', 'JAHAN_ACADEMIA')
    ON CONFLICT ("userId", "branchId") DO NOTHING
    RETURNING "userId", "branchId"
)
INSERT INTO iam_audit_events (id, action, "entityType", "entityId", outcome, metadata)
  SELECT gen_random_uuid(), 'iam.branches.owner-approved-backfill', 'USER', "userId"::text, 'SUCCESS',
    jsonb_build_object('source', 'FIVE-BRANCH-COMPANY-1019', 'addedBranchIds', jsonb_agg("branchId"), 'operationalPermissionsChanged', false)
  FROM added GROUP BY "userId";

INSERT INTO legal_entities (id, code, "persianName", "latinName", "updatedAt") VALUES
  ('20000000-0000-4000-8000-000000000001', 'NIYAYESH_SEIR_SAHAR', 'شرکت نیایش سیر سحر', 'Niyayesh Seir Sahar', CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000002', 'JAHAN_BASTAN', 'شرکت جهان باستان', 'Jahan Bastan', CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000004', 'GHESATI_RO', 'شرکت قسطی رو', 'Ghesati Ro', CURRENT_TIMESTAMP),
  ('20000000-0000-4000-8000-000000000003', 'JAHAN_ACADEMIA', 'شرکت جهان آکادمی', 'Jahan Academy', CURRENT_TIMESTAMP)
  ON CONFLICT (code) DO NOTHING;

UPDATE legal_entities SET "isActive" = true, "deactivatedAt" = NULL,
  version = version + 1, "updatedAt" = CURRENT_TIMESTAMP
  WHERE code IN ('NIYAYESH_SEIR_SAHAR', 'JAHAN_BASTAN', 'GHESATI_RO', 'JAHAN_ACADEMIA') AND NOT "isActive";
COMMIT;
