ALTER TABLE website_publications ADD COLUMN "salesStopped" boolean NOT NULL DEFAULT false;
CREATE TABLE website_catalog_deliveries (
 "siteCode" varchar(40) PRIMARY KEY,
 "branchId" uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
 revision bigint NOT NULL DEFAULT 1,
 "deliveredRevision" bigint NOT NULL DEFAULT 0,
 "deliveredAt" timestamptz(3),
 "nextRefreshAt" timestamptz(3)
);

-- A statement invalidates the catalog in the same transaction as the source write.
-- This is a coalescing outbox, not an HTTP request on the business write path.
CREATE FUNCTION website_catalog_invalidate() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 UPDATE website_catalog_deliveries SET revision = revision + 1;
 RETURN NULL;
END;
$$;
DO $$
DECLARE t text;
BEGIN
 FOR t IN SELECT tablename FROM pg_tables WHERE schemaname='public' AND (
   tablename IN ('website_publications','TourPackage','TourDeparture','TicketPublishedOffer',
   'TicketOfferStandaloneSalePrice','TicketOfferRoundTripSalePrice','TicketOfferSalePriceTier',
   'TicketOfferCapacityAllocation','TicketOfferCapacityHold','TicketOfferSaleRoute',
   'TicketSaleCommissionRevision','TicketSalePriceTarget','PackagePricingTourDraft',
   'PackagePricingTourPublishedVersion','PackagePricingTourPublishedRoomPrice',
   'PackagePricingTourCombinationSource','ReservationHotelGroupRate','ReservationHotelRateBatch',
   'ReservationHotelRatePack','ReservationHotelRoomRate','master_countries','master_cities',
   'master_airports','master_hotels','master_room_types','master_meal_services','master_airlines',
   'master_cabin_classes','master_baggage_rules','master_hotel_facilities','master_facilities')
 ) LOOP
  EXECUTE format('CREATE TRIGGER website_catalog_changed AFTER INSERT OR UPDATE OR DELETE ON %I FOR EACH STATEMENT EXECUTE FUNCTION website_catalog_invalidate()', t);
 END LOOP;
END $$;

-- New publications for the connected branch appear on that branch's website.
-- Updating prices never re-enables an explicitly removed publication.
CREATE FUNCTION website_catalog_auto_publish() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE resource uuid; branch uuid; product_kind text;
BEGIN
 IF TG_TABLE_NAME = 'PackagePricingTourPublishedVersion' THEN
  SELECT "tourDepartureId", "branchId" INTO resource, branch FROM "PackagePricingTourDraft" WHERE id=NEW."draftId";
  product_kind := 'tour';
 ELSE
  IF NEW."salePriceTargetId" IS NOT NULL THEN RETURN NULL; END IF;
  SELECT id, "branchId" INTO resource, branch FROM "TicketPublishedOffer" WHERE id=NEW."offerId";
  product_kind := 'ticket';
 END IF;
 INSERT INTO website_publications (id,"siteCode","branchId",kind,"resourceId",enabled,version,"updatedAt")
 SELECT gen_random_uuid(),"siteCode",branch,product_kind,resource,true,1,now()
 FROM website_catalog_deliveries WHERE "branchId"=branch
 ON CONFLICT ("siteCode","branchId",kind,"resourceId") DO NOTHING;
 RETURN NULL;
END;
$$;
CREATE TRIGGER website_tour_auto_publish AFTER INSERT ON "PackagePricingTourPublishedVersion"
 FOR EACH ROW EXECUTE FUNCTION website_catalog_auto_publish();
CREATE TRIGGER website_ticket_auto_publish AFTER INSERT ON "TicketOfferStandaloneSalePrice"
 FOR EACH ROW EXECUTE FUNCTION website_catalog_auto_publish();
