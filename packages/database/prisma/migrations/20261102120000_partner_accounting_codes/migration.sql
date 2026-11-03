BEGIN;
SET LOCAL lock_timeout = '15s';
LOCK TABLE master_organizations, master_suppliers, master_brokers, "FinanceSettlementAccount" IN ACCESS EXCLUSIVE MODE;

ALTER TABLE master_organizations ADD COLUMN "accountingCode" varchar(7);
ALTER TABLE master_suppliers ADD COLUMN "accountingCode" varchar(7);
ALTER TABLE master_brokers ADD COLUMN "accountingCode" varchar(7);
ALTER TABLE "FinanceSettlementAccount" ADD COLUMN "accountingCode" varchar(7);

-- One identity across roles. Linked partner creation dates participate in ordering.
CREATE TEMP TABLE company_code_backfill ON COMMIT DROP AS
WITH identities AS (
  SELECT 'organization' AS kind, id, "createdAt" FROM master_organizations
  UNION ALL
  SELECT CASE WHEN "organizationId" IS NULL THEN 'supplier' ELSE 'organization' END,
    COALESCE("organizationId", id), "createdAt" FROM master_suppliers
  UNION ALL
  SELECT CASE WHEN "organizationId" IS NULL THEN 'broker' ELSE 'organization' END,
    COALESCE("organizationId", id), "createdAt" FROM master_brokers
), canonical AS (
  SELECT kind, id, min("createdAt") AS created FROM identities GROUP BY kind, id
)
SELECT kind, id, (3000000 + row_number() OVER (ORDER BY created, id, kind))::text AS code FROM canonical;

UPDATE master_organizations o SET "accountingCode" = c.code FROM company_code_backfill c
WHERE c.kind = 'organization' AND c.id = o.id;
UPDATE master_suppliers s SET "accountingCode" = c.code FROM company_code_backfill c
WHERE c.id = COALESCE(s."organizationId", s.id)
AND c.kind = CASE WHEN s."organizationId" IS NULL THEN 'supplier' ELSE 'organization' END;
UPDATE master_brokers b SET "accountingCode" = c.code FROM company_code_backfill c
WHERE c.id = COALESCE(b."organizationId", b.id)
AND c.kind = CASE WHEN b."organizationId" IS NULL THEN 'broker' ELSE 'organization' END;
WITH ranked AS (
  SELECT id, (5000000 + row_number() OVER (ORDER BY "createdAt", id))::text AS code
  FROM "FinanceSettlementAccount" WHERE kind = 'BANK'
)
UPDATE "FinanceSettlementAccount" a SET "accountingCode" = r.code FROM ranked r WHERE a.id = r.id;

CREATE SEQUENCE company_accounting_code_seq MINVALUE 3000001 MAXVALUE 3999999 NO CYCLE;
CREATE SEQUENCE bank_accounting_code_seq MINVALUE 5000001 MAXVALUE 5999999 NO CYCLE;
SELECT setval('company_accounting_code_seq', GREATEST(3000001, COALESCE((SELECT max(code::bigint) FROM company_code_backfill), 3000001)), EXISTS(SELECT 1 FROM company_code_backfill));
SELECT setval('bank_accounting_code_seq', GREATEST(5000001, COALESCE((SELECT max("accountingCode"::bigint) FROM "FinanceSettlementAccount"), 5000001)), EXISTS(SELECT 1 FROM "FinanceSettlementAccount" WHERE "accountingCode" IS NOT NULL));

CREATE UNIQUE INDEX "master_organizations_accountingCode_key" ON master_organizations("accountingCode");
CREATE UNIQUE INDEX "master_suppliers_accountingCode_key" ON master_suppliers("accountingCode");
CREATE UNIQUE INDEX "master_brokers_accountingCode_key" ON master_brokers("accountingCode");
CREATE UNIQUE INDEX "FinanceSettlementAccount_accountingCode_key" ON "FinanceSettlementAccount"("accountingCode");
ALTER TABLE master_organizations ADD CONSTRAINT organization_accounting_code_format CHECK ("accountingCode" IS NOT NULL AND "accountingCode" ~ '^3[0-9]{6}$');
ALTER TABLE master_suppliers ADD CONSTRAINT supplier_accounting_code_format CHECK ("accountingCode" IS NOT NULL AND "accountingCode" ~ '^3[0-9]{6}$');
ALTER TABLE master_brokers ADD CONSTRAINT broker_accounting_code_format CHECK ("accountingCode" IS NOT NULL AND "accountingCode" ~ '^3[0-9]{6}$');
ALTER TABLE "FinanceSettlementAccount" ADD CONSTRAINT bank_accounting_code_format CHECK ((kind = 'BANK' AND "accountingCode" IS NOT NULL AND "accountingCode" ~ '^5[0-9]{6}$') OR (kind <> 'BANK' AND "accountingCode" IS NULL));

CREATE FUNCTION assign_company_accounting_code() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_code text;
BEGIN
  IF TG_OP = 'UPDATE' AND NEW."accountingCode" IS DISTINCT FROM OLD."accountingCode" THEN
    RAISE EXCEPTION 'Accounting code is immutable';
  END IF;
  IF TG_TABLE_NAME = 'master_organizations' THEN
    IF TG_OP = 'INSERT' THEN
      IF NEW."accountingCode" IS NULL THEN
        NEW."accountingCode" := nextval('company_accounting_code_seq')::text;
      ELSE
        -- Internal dossier promotion may carry the standalone party's existing code.
        PERFORM 1 FROM master_suppliers WHERE "organizationId" IS NULL AND "accountingCode" = NEW."accountingCode" FOR UPDATE;
        IF NOT FOUND THEN
          PERFORM 1 FROM master_brokers WHERE "organizationId" IS NULL AND "accountingCode" = NEW."accountingCode" FOR UPDATE;
          IF NOT FOUND THEN RAISE EXCEPTION 'Accounting code must be generated'; END IF;
        END IF;
      END IF;
    END IF;
  ELSE
    IF NEW."organizationId" IS NOT NULL THEN
      SELECT "accountingCode" INTO STRICT parent_code FROM master_organizations WHERE id = NEW."organizationId";
      IF NEW."accountingCode" IS NOT NULL AND NEW."accountingCode" <> parent_code THEN
        RAISE EXCEPTION 'Linking would change an existing accounting identity';
      END IF;
      NEW."accountingCode" := parent_code;
    ELSIF TG_OP = 'INSERT' THEN
      IF NEW."accountingCode" IS NOT NULL THEN RAISE EXCEPTION 'Accounting code must be generated'; END IF;
      NEW."accountingCode" := nextval('company_accounting_code_seq')::text;
    ELSIF OLD."organizationId" IS NOT NULL THEN
      RAISE EXCEPTION 'An accounting identity cannot be detached';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER company_accounting_code BEFORE INSERT OR UPDATE ON master_organizations FOR EACH ROW EXECUTE FUNCTION assign_company_accounting_code();
CREATE TRIGGER supplier_accounting_code BEFORE INSERT OR UPDATE ON master_suppliers FOR EACH ROW EXECUTE FUNCTION assign_company_accounting_code();
CREATE TRIGGER broker_accounting_code BEFORE INSERT OR UPDATE ON master_brokers FOR EACH ROW EXECUTE FUNCTION assign_company_accounting_code();

CREATE FUNCTION assign_bank_accounting_code() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND (NEW."accountingCode" IS DISTINCT FROM OLD."accountingCode" OR NEW.kind IS DISTINCT FROM OLD.kind) THEN
    RAISE EXCEPTION 'Accounting identity is immutable';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."accountingCode" IS NOT NULL THEN RAISE EXCEPTION 'Accounting code must be generated'; END IF;
    IF NEW.kind = 'BANK' THEN NEW."accountingCode" := nextval('bank_accounting_code_seq')::text; END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER bank_accounting_code BEFORE INSERT OR UPDATE ON "FinanceSettlementAccount" FOR EACH ROW EXECUTE FUNCTION assign_bank_accounting_code();
COMMIT;
