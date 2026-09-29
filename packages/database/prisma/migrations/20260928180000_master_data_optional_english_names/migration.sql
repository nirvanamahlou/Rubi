-- English titles are optional in Master Data. Existing values are preserved.
ALTER TABLE "master_countries" ALTER COLUMN "englishName" DROP NOT NULL;
ALTER TABLE "master_regions" ALTER COLUMN "englishName" DROP NOT NULL;
ALTER TABLE "master_cities" ALTER COLUMN "englishName" DROP NOT NULL;
ALTER TABLE "master_airports" ALTER COLUMN "englishName" DROP NOT NULL;
