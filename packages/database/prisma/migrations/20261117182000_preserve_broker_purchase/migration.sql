-- Do not supersede a purchase after real funds have been dispatched against it.
-- The reservation writer and the funding writer both hold the intake advisory lock.
CREATE FUNCTION protect_funded_reservation_purchase() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM "ReservationServicePurchase" p
   JOIN finance_broker_transfers t ON t."purchaseId"=p.id
   WHERE p."intakeId"=NEW."intakeId" AND p.version<NEW.version
   AND (NEW."batchId" IS NULL OR NEW."batchId" IS DISTINCT FROM p."batchId")
   AND (p."serviceClientKey"=NEW."serviceClientKey" OR p."coveredServiceClientKeys" ? NEW."serviceClientKey"
        OR NEW."coveredServiceClientKeys" ? p."serviceClientKey"
        OR NEW."coveredServiceClientKeys" ?| ARRAY(SELECT jsonb_array_elements_text(p."coveredServiceClientKeys")))
 ) THEN RAISE EXCEPTION 'Cannot replace a purchase with a funded broker transfer' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER protect_funded_reservation_purchase BEFORE INSERT ON "ReservationServicePurchase"
FOR EACH ROW EXECUTE FUNCTION protect_funded_reservation_purchase();
