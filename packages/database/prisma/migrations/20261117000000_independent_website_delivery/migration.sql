ALTER TABLE website_catalog_deliveries
  ADD COLUMN "attemptedRevision" bigint NOT NULL DEFAULT 0,
  ADD COLUMN "lastError" varchar(80);
UPDATE website_catalog_deliveries SET "attemptedRevision" = "deliveredRevision";
CREATE UNIQUE INDEX website_delivery_distinct_sales_target ON website_catalog_deliveries ("salePriceTargetId")
  WHERE "siteCode" IN ('nss','jahan-bastan');
CREATE OR REPLACE FUNCTION website_ticket_target_publish() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE delivery record; target_ids uuid[]; offer_branch uuid; resource uuid; visible boolean;
BEGIN
 IF NEW."salePriceTargetId" IS NULL THEN RETURN NULL; END IF;
 SELECT "branchId" INTO offer_branch FROM "TicketPublishedOffer" WHERE id=NEW."offerId";
 FOR delivery IN SELECT * FROM website_catalog_deliveries WHERE "branchId"=offer_branch AND ("salePriceTargetId"=NEW."salePriceTargetId" OR ("siteCode"='nss' AND "salePriceTargetId" IS NULL)) ORDER BY "siteCode" FOR UPDATE LOOP
  IF delivery."salePriceTargetId" IS NULL THEN
   SELECT array_agg(id) INTO target_ids FROM "TicketSalePriceTarget" WHERE "branchId"=offer_branch AND "isActive" AND regexp_replace(translate(name,'يك','یک'),'\s','','g')='نیایشسیرسحر';
   IF cardinality(target_ids) IS DISTINCT FROM 1 OR target_ids[1]<>NEW."salePriceTargetId" THEN CONTINUE; END IF;
   UPDATE website_catalog_deliveries SET "salePriceTargetId"=target_ids[1],revision=revision+1 WHERE "siteCode"=delivery."siteCode";
   delivery."salePriceTargetId" := target_ids[1];
  END IF;
  IF delivery."salePriceTargetId"<>NEW."salePriceTargetId" THEN CONTINUE; END IF;
  FOR resource IN SELECT DISTINCT id FROM unnest(ARRAY[NEW."offerId",NEW."returnOfferId"]) id WHERE id IS NOT NULL LOOP
   SELECT EXISTS (
    SELECT 1 FROM (SELECT DISTINCT ON ("offerId","returnOfferId") * FROM "TicketSaleCommissionRevision" WHERE "salePriceTargetId"=delivery."salePriceTargetId" ORDER BY "offerId","returnOfferId",revision DESC) latest
    WHERE (latest."offerId"=resource OR latest."returnOfferId"=resource) AND latest.percent<100
   ) INTO visible;
   INSERT INTO website_publications (id,"siteCode","branchId",kind,"resourceId",enabled,"salesStopped",version,"updatedAt")
   VALUES (gen_random_uuid(),delivery."siteCode",offer_branch,'ticket',resource,visible,false,1,now())
   ON CONFLICT ("siteCode","branchId",kind,"resourceId","periodKey") DO UPDATE SET enabled=excluded.enabled,"salesStopped"=false,version=website_publications.version+1,"updatedAt"=now();
  END LOOP;
 END LOOP;
 RETURN NULL;
END;
$$;
CREATE OR REPLACE FUNCTION website_catalog_logo_source_changed() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  document_ids uuid[] := ARRAY[]::uuid[];
BEGIN
  IF TG_TABLE_NAME = 'documents' THEN
    IF TG_OP <> 'INSERT' THEN
      document_ids := array_append(document_ids, OLD.id);
    END IF;
    IF TG_OP <> 'DELETE' THEN
      document_ids := array_append(document_ids, NEW.id);
    END IF;
  ELSE
    IF TG_OP <> 'INSERT' THEN document_ids := array_append(document_ids, OLD.document_id); END IF;
    IF TG_OP <> 'DELETE' THEN document_ids := array_append(document_ids, NEW.document_id); END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM master_airlines WHERE "logoFileReference" = ANY(document_ids)) THEN
    UPDATE website_catalog_deliveries SET revision = revision + 1
      WHERE "siteCode" IN ('nss', 'jahan-bastan');
  END IF;
  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
  RETURN NEW;
END;
$$;
