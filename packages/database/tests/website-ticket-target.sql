-- Dedicated empty disposable PostgreSQL database only; contains synthetic identities.
\set ON_ERROR_STOP on
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE branches(id uuid PRIMARY KEY);
CREATE TABLE website_publications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), "siteCode" varchar(40), "branchId" uuid, kind text, "resourceId" uuid, enabled bool DEFAULT false, version int DEFAULT 1, "updatedAt" timestamptz DEFAULT now(), UNIQUE("siteCode","branchId",kind,"resourceId"));
CREATE TABLE "TicketPublishedOffer" (id uuid PRIMARY KEY, "branchId" uuid);
CREATE TABLE "TicketOfferStandaloneSalePrice" (id uuid DEFAULT gen_random_uuid(), "offerId" uuid, "salePriceTargetId" uuid);
CREATE TABLE "PackagePricingTourDraft" (id uuid PRIMARY KEY, "tourDepartureId" uuid, "branchId" uuid);
CREATE TABLE "PackagePricingTourPublishedVersion" (id uuid DEFAULT gen_random_uuid(), "draftId" uuid);
CREATE TABLE "TicketOfferCapacityAllocation" (id uuid);

CREATE TABLE "TicketSalePriceTarget"(id uuid PRIMARY KEY,"branchId" uuid,name text,"isActive" bool);
CREATE TABLE "TicketSaleCommissionRevision"(id uuid DEFAULT gen_random_uuid(),"offerId" uuid,"returnOfferId" uuid,"salePriceTargetId" uuid,percent numeric,revision int);

\ir ../prisma/migrations/20261115090000_website_catalog_delivery/migration.sql
\ir ../prisma/migrations/20261115130000_website_ticket_price_target/migration.sql

INSERT INTO branches VALUES ('00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000009');
INSERT INTO website_catalog_deliveries ("siteCode","branchId") VALUES ('nss','00000000-0000-4000-8000-000000000001');
INSERT INTO "TicketPublishedOffer" VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000001'),('00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000001');
INSERT INTO "TicketSalePriceTarget" VALUES ('00000000-0000-4000-8000-000000000004','00000000-0000-4000-8000-000000000001','نیایش سیر سحر',true),('00000000-0000-4000-8000-000000000005','00000000-0000-4000-8000-000000000009','نیایش سیر سحر',true);
INSERT INTO "TicketOfferStandaloneSalePrice" ("offerId") VALUES ('00000000-0000-4000-8000-000000000002');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM website_publications) THEN RAISE EXCEPTION 'base price auto-published'; END IF; END $$;
INSERT INTO "TicketSaleCommissionRevision" ("offerId","salePriceTargetId",percent,revision) VALUES ('00000000-0000-4000-8000-000000000002',null,4,1),('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000005',4,1);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM website_publications) THEN RAISE EXCEPTION 'wrong target published'; END IF; END $$;
BEGIN;
INSERT INTO "TicketSaleCommissionRevision" ("offerId","salePriceTargetId",percent,revision) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000004',4,1);
ROLLBACK;
DO $$ BEGIN IF EXISTS(SELECT 1 FROM website_publications) THEN RAISE EXCEPTION 'rollback published'; END IF; END $$;
INSERT INTO "TicketSaleCommissionRevision" ("offerId","returnOfferId","salePriceTargetId",percent,revision) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',4,1);
DO $$ BEGIN IF (SELECT count(*) FROM website_publications WHERE enabled)<>2 THEN RAISE EXCEPTION 'pair not published'; END IF; IF (SELECT "salePriceTargetId" FROM website_catalog_deliveries)<>'00000000-0000-4000-8000-000000000004' THEN RAISE EXCEPTION 'stable target not bound'; END IF; END $$;
UPDATE website_publications SET enabled=false,"salesStopped"=true;
INSERT INTO "TicketOfferStandaloneSalePrice" ("offerId") VALUES ('00000000-0000-4000-8000-000000000002');
DO $$ BEGIN IF EXISTS(SELECT 1 FROM website_publications WHERE enabled OR NOT "salesStopped") THEN RAISE EXCEPTION 'base change resurrected product'; END IF; END $$;
UPDATE "TicketSalePriceTarget" SET name='renamed' WHERE id='00000000-0000-4000-8000-000000000004';
INSERT INTO "TicketSaleCommissionRevision" ("offerId","returnOfferId","salePriceTargetId",percent,revision) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',0,2);
DO $$ BEGIN IF (SELECT count(*) FROM website_publications WHERE enabled AND NOT "salesStopped")<>2 THEN RAISE EXCEPTION 'explicit re-save failed after rename'; END IF; END $$;
INSERT INTO "TicketSaleCommissionRevision" ("offerId","returnOfferId","salePriceTargetId",percent,revision) VALUES ('00000000-0000-4000-8000-000000000002','00000000-0000-4000-8000-000000000003','00000000-0000-4000-8000-000000000004',100,3);
DO $$ BEGIN IF EXISTS(SELECT 1 FROM website_publications WHERE enabled) THEN RAISE EXCEPTION 'hidden fare published'; END IF; END $$;
SELECT 'PASS: explicit destination save, base-only exclusion, branch scope, pair publication, rollback, stable identity, zero/100, explicit re-save, no base resurrection';
