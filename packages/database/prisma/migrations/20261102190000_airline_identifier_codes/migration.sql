SET lock_timeout = '5s';
ALTER TABLE "master_airlines" ALTER COLUMN "code" TYPE VARCHAR(64) USING rtrim("code");
