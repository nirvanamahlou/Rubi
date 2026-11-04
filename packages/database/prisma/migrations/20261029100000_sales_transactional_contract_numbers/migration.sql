-- Additive cutover: stop all legacy API writers before applying this migration,
-- then start only the API that uses the transactional counter. Do not mix versions.
-- Keep existing contract numbers and the legacy sequence for audit/compatibility.
CREATE TABLE "sales_contract_number_counters" (
  "id" INTEGER NOT NULL,
  "last_number" INTEGER NOT NULL,
  CONSTRAINT "sales_contract_number_counters_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sales_contract_number_counter_singleton" CHECK ("id" = 1),
  CONSTRAINT "sales_contract_number_counter_range" CHECK ("last_number" BETWEEN 120122 AND 999999)
);

-- Never reuse a number that a prior API may already have shown, including a
-- consumed sequence value whose contract transaction rolled back.
INSERT INTO "sales_contract_number_counters" ("id", "last_number")
SELECT 1, GREATEST(
  120122,
  COALESCE((SELECT MAX("contract_number"::INTEGER)
    FROM "sales_contracts" WHERE "contract_number" ~ '^[0-9]{6}$'), 120122),
  (SELECT CASE WHEN is_called THEN last_value ELSE last_value - 1 END
    FROM "sales_contract_public_number_seq")
);
