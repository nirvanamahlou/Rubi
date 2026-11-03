-- Sale publication may precede flight purchase/payment. Retain all historical
-- cost references and the existing restrictive foreign key.
ALTER TABLE "PackagePricingTourPublishedVersion"
ALTER COLUMN "outboundCostRevisionId" DROP NOT NULL;
