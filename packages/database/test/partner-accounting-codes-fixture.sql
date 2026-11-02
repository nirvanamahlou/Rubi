-- Run only in a new disposable PostgreSQL database, before the target migration.
CREATE TABLE master_organizations(id uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL);
CREATE TABLE master_suppliers(id uuid PRIMARY KEY, "organizationId" uuid REFERENCES master_organizations(id), "createdAt" timestamptz NOT NULL);
CREATE TABLE master_brokers(id uuid PRIMARY KEY, "organizationId" uuid REFERENCES master_organizations(id), "createdAt" timestamptz NOT NULL);
CREATE TABLE "FinanceSettlementAccount"(id uuid PRIMARY KEY, "createdAt" timestamptz NOT NULL, kind text NOT NULL);
INSERT INTO master_organizations VALUES ('00000000-0000-4000-8000-000000000001','2026-02-01'),('00000000-0000-4000-8000-000000000002','2026-02-02');
INSERT INTO master_suppliers VALUES ('00000000-0000-4000-8000-000000000003',null,'2026-01-01');
INSERT INTO master_brokers VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000002','2026-01-15');
INSERT INTO "FinanceSettlementAccount" VALUES ('00000000-0000-4000-8000-000000000005','2026-02-01','BANK'),('00000000-0000-4000-8000-000000000006','2026-01-01','BANK'),('00000000-0000-4000-8000-000000000007','2025-01-01','CASH');
