ALTER TABLE "PackagePricingTourDraft"
  ADD COLUMN "commissionMode" VARCHAR(12) NOT NULL DEFAULT 'percent',
  ADD COLUMN "commissionAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
  ADD COLUMN "commissionCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'IRR';

ALTER TABLE "PackagePricingTourPublishedVersion"
  ADD COLUMN "commissionMode" VARCHAR(12) NOT NULL DEFAULT 'percent',
  ADD COLUMN "commissionAmount" DECIMAL(24,4) NOT NULL DEFAULT 0,
  ADD COLUMN "commissionCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'IRR';

ALTER TABLE "PackagePricingTourDraft"
  ADD CONSTRAINT "PackagePricingTourDraft_commissionMode_check"
  CHECK ("commissionMode" IN ('percent', 'fixed'));

ALTER TABLE "PackagePricingTourPublishedVersion"
  ADD CONSTRAINT "PackagePricingTourPublishedVersion_commissionMode_check"
  CHECK ("commissionMode" IN ('percent', 'fixed'));
