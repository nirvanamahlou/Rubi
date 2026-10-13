ALTER TABLE "master_acquaintance_methods"
  ADD COLUMN "englishName" VARCHAR(160),
  ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "master_acquaintance_methods"
  ADD CONSTRAINT "master_acquaintance_methods_display_order_check" CHECK ("displayOrder" >= 0);

CREATE INDEX "master_acquaintance_methods_isActive_displayOrder_name_idx"
  ON "master_acquaintance_methods"("isActive", "displayOrder", "name");

CREATE TABLE "master_lead_sources" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "description" VARCHAR(500),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_lead_sources_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_lead_sources_display_order_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "master_sales_channels" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "description" VARCHAR(500),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_sales_channels_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_sales_channels_display_order_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "master_lost_reasons" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "description" VARCHAR(500),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_lost_reasons_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_lost_reasons_display_order_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "master_customer_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "description" VARCHAR(500),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_customer_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_customer_types_display_order_check" CHECK ("displayOrder" >= 0)
);

CREATE TABLE "master_tags" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "description" VARCHAR(500),
  "colorHex" CHAR(7),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_tags_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_tags_display_order_check" CHECK ("displayOrder" >= 0),
  CONSTRAINT "master_tags_color_hex_check" CHECK ("colorHex" IS NULL OR "colorHex" ~ '^#[0-9A-F]{6}$')
);

CREATE TABLE "master_campaign_types" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "englishName" VARCHAR(160),
  "description" VARCHAR(500),
  "displayOrder" INTEGER NOT NULL DEFAULT 0,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID NOT NULL,
  "deactivatedByUserId" UUID,
  "deactivatedAt" TIMESTAMPTZ(3),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMPTZ(3) NOT NULL,
  CONSTRAINT "master_campaign_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "master_campaign_types_display_order_check" CHECK ("displayOrder" >= 0)
);

CREATE UNIQUE INDEX "master_lead_sources_code_key" ON "master_lead_sources"("code");
CREATE INDEX "master_lead_sources_isActive_displayOrder_name_idx" ON "master_lead_sources"("isActive", "displayOrder", "name");
CREATE UNIQUE INDEX "master_sales_channels_code_key" ON "master_sales_channels"("code");
CREATE INDEX "master_sales_channels_isActive_displayOrder_name_idx" ON "master_sales_channels"("isActive", "displayOrder", "name");
CREATE UNIQUE INDEX "master_lost_reasons_code_key" ON "master_lost_reasons"("code");
CREATE INDEX "master_lost_reasons_isActive_displayOrder_name_idx" ON "master_lost_reasons"("isActive", "displayOrder", "name");
CREATE UNIQUE INDEX "master_customer_types_code_key" ON "master_customer_types"("code");
CREATE INDEX "master_customer_types_isActive_displayOrder_name_idx" ON "master_customer_types"("isActive", "displayOrder", "name");
CREATE UNIQUE INDEX "master_tags_code_key" ON "master_tags"("code");
CREATE INDEX "master_tags_isActive_displayOrder_name_idx" ON "master_tags"("isActive", "displayOrder", "name");
CREATE UNIQUE INDEX "master_campaign_types_code_key" ON "master_campaign_types"("code");
CREATE INDEX "master_campaign_types_isActive_displayOrder_name_idx" ON "master_campaign_types"("isActive", "displayOrder", "name");
