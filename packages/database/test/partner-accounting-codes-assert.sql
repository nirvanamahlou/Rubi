\set ON_ERROR_STOP on
DO $$ BEGIN
 IF (SELECT "accountingCode" FROM master_suppliers LIMIT 1) <> '3000001' THEN RAISE EXCEPTION 'Global chronology failed'; END IF;
 IF (SELECT "accountingCode" FROM master_brokers LIMIT 1) <> '3000002' THEN RAISE EXCEPTION 'Linked identity chronology failed'; END IF;
 IF (SELECT "accountingCode" FROM master_organizations WHERE id='00000000-0000-4000-8000-000000000002') <> '3000002' THEN RAISE EXCEPTION 'Shared role identity failed'; END IF;
 IF (SELECT "accountingCode" FROM "FinanceSettlementAccount" WHERE id='00000000-0000-4000-8000-000000000006') <> '5000001' THEN RAISE EXCEPTION 'Bank chronology failed'; END IF;
 IF (SELECT "accountingCode" FROM "FinanceSettlementAccount" WHERE kind='CASH') IS NOT NULL THEN RAISE EXCEPTION 'Cash must not receive bank code'; END IF;
END $$;
-- Promotion keeps the standalone supplier code, even with a newly created dossier.
INSERT INTO master_organizations VALUES ('00000000-0000-4000-8000-000000000008',now(),'3000001');
UPDATE master_suppliers SET "organizationId"='00000000-0000-4000-8000-000000000008';
INSERT INTO master_organizations(id,"createdAt") VALUES ('00000000-0000-4000-8000-000000000009',now());
DO $$ BEGIN
 IF (SELECT "accountingCode" FROM master_organizations WHERE id='00000000-0000-4000-8000-000000000009') <> '3000004' THEN RAISE EXCEPTION 'Next company code failed'; END IF;
 BEGIN
   UPDATE master_suppliers SET "organizationId"='00000000-0000-4000-8000-000000000009';
   RAISE EXCEPTION 'Unexpected identity rewrite' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
 BEGIN
   UPDATE master_organizations SET "accountingCode"='3000099';
   RAISE EXCEPTION 'Unexpected manual edit' USING ERRCODE='P0002';
 EXCEPTION WHEN SQLSTATE 'P0001' THEN NULL; END;
END $$;
DELETE FROM master_organizations WHERE id='00000000-0000-4000-8000-000000000009';
INSERT INTO master_organizations(id,"createdAt") VALUES ('00000000-0000-4000-8000-000000000010',now());
INSERT INTO "FinanceSettlementAccount"(id,"createdAt",kind) VALUES ('00000000-0000-4000-8000-000000000011',now(),'BANK');
DO $$ BEGIN
 IF (SELECT "accountingCode" FROM master_organizations WHERE id='00000000-0000-4000-8000-000000000010') <> '3000005' THEN RAISE EXCEPTION 'Deleted code reused'; END IF;
 IF (SELECT "accountingCode" FROM "FinanceSettlementAccount" WHERE id='00000000-0000-4000-8000-000000000011') <> '5000003' THEN RAISE EXCEPTION 'Next bank code failed'; END IF;
END $$;
