BEGIN;
-- Human operation reasons are optional; numerical and immutable-history guards remain.
ALTER TABLE "procurement_receipt_adjustment" DROP CONSTRAINT "procurement_receipt_adjustment_delta_check";
ALTER TABLE "procurement_receipt_adjustment" ADD CONSTRAINT "procurement_receipt_adjustment_delta_check" CHECK (
  "receivedDelta" <> 'NaN'::numeric AND "acceptedDelta" <> 'NaN'::numeric AND "rejectedDelta" <> 'NaN'::numeric
  AND ("receivedDelta" <> 0 OR "acceptedDelta" <> 0 OR "rejectedDelta" <> 0)
);
COMMIT;
