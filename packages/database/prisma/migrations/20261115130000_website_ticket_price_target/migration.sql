-- Bind a stable target identity; renaming it later does not change the website destination.
ALTER TABLE website_catalog_deliveries ADD COLUMN "salePriceTargetId" uuid;
ALTER TABLE website_catalog_deliveries ADD CONSTRAINT "website_catalog_deliveries_salePriceTargetId_fkey" FOREIGN KEY ("salePriceTargetId") REFERENCES "TicketSalePriceTarget"(id) ON DELETE RESTRICT ON UPDATE CASCADE;
DROP TRIGGER IF EXISTS website_ticket_auto_publish ON "TicketOfferStandaloneSalePrice";

CREATE FUNCTION website_ticket_target_publish() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE delivery record; target_ids uuid[]; offer_branch uuid; resource uuid; visible boolean;
BEGIN
 IF NEW."salePriceTargetId" IS NULL THEN RETURN NULL; END IF;
 SELECT "branchId" INTO offer_branch FROM "TicketPublishedOffer" WHERE id=NEW."offerId";
 FOR delivery IN SELECT * FROM website_catalog_deliveries WHERE "siteCode"='nss' AND "branchId"=offer_branch FOR UPDATE LOOP
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
   ON CONFLICT ("siteCode","branchId",kind,"resourceId") DO UPDATE SET enabled=excluded.enabled,"salesStopped"=false,version=website_publications.version+1,"updatedAt"=now();
  END LOOP;
 END LOOP;
 RETURN NULL;
END;
$$;
CREATE TRIGGER website_ticket_target_publish AFTER INSERT ON "TicketSaleCommissionRevision" FOR EACH ROW EXECUTE FUNCTION website_ticket_target_publish();
