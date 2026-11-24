ALTER TABLE "master_countries"
ADD COLUMN "sourceMainImage" VARCHAR(2000),
ADD COLUMN "sourceGalleryImages" VARCHAR(2000);

ALTER TABLE "master_cities"
ADD COLUMN "sourceMainImage" VARCHAR(2000),
ADD COLUMN "sourceGalleryImages" VARCHAR(2000);
