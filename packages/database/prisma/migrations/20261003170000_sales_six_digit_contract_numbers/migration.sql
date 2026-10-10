-- Existing prefixed contract numbers remain unchanged.
CREATE SEQUENCE "sales_contract_public_number_seq"
  AS INTEGER MINVALUE 120123 MAXVALUE 999999 START WITH 120123 NO CYCLE;

-- Preserve uniqueness if numeric contracts were imported before this rollout.
SELECT setval(
  'sales_contract_public_number_seq',
  GREATEST(120123, COALESCE((
    SELECT MAX("contract_number"::INTEGER) + 1
    FROM "sales_contracts"
    WHERE "contract_number" ~ '^[0-9]{6}$'
  ), 120123)),
  false
);
