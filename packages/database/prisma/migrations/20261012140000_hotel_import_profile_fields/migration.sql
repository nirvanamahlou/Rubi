-- Preserve optional descriptive workbook values without changing any existing hotel.
-- Source refund/image/featured values do not replace owning-module policies or files.
ALTER TABLE "master_hotels"
  ADD COLUMN "serviceLevel" VARCHAR(160),
  ADD COLUMN "internalNote" VARCHAR(2000),
  ADD COLUMN "sourceDestination" VARCHAR(160),
  ADD COLUMN "sourceRefundRules" VARCHAR(2000),
  ADD COLUMN "sourceMainImage" VARCHAR(2000),
  ADD COLUMN "sourceGalleryImages" VARCHAR(2000),
  ADD COLUMN "sourceFeatured" BOOLEAN;
