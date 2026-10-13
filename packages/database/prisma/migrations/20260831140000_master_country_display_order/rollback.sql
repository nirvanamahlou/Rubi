-- Manual recovery ONLY for an isolated test database or with explicit operator approval
-- and a verified backup of displayOrder values. Prefer rolling back the app while
-- retaining this backward-compatible column in any database with user data.
ALTER TABLE "master_countries" DROP CONSTRAINT "master_country_display_order_check";
ALTER TABLE "master_countries" DROP COLUMN "displayOrder";
