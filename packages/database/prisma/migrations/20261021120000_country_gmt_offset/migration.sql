SET lock_timeout = '10s';
ALTER TABLE "master_countries" ADD COLUMN "gmtOffset" VARCHAR(6);
ALTER TABLE "master_countries" ADD CONSTRAINT "master_countries_gmt_offset_check"
CHECK ("gmtOffset" IS NULL OR "gmtOffset" ~ '^([+]((0[0-9]|1[0-3]):[0-5][0-9]|14:00)|-((0[0-9]|1[01]):[0-5][0-9]|12:00))$');
RESET lock_timeout;
