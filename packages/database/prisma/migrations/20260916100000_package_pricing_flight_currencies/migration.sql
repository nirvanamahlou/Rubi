ALTER TABLE "PackagePricingTourDraft"
  ADD COLUMN "adultFlightSaleCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'IRR',
  ADD COLUMN "childFlightSaleCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'IRR',
  ADD COLUMN "businessUpliftCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'IRR';

ALTER TABLE "PackagePricingTourPublishedVersion"
  ADD COLUMN "adultFlightSaleCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'IRR',
  ADD COLUMN "childFlightSaleCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'IRR',
  ADD COLUMN "businessUpliftCurrencyCode" VARCHAR(3) NOT NULL DEFAULT 'IRR';
