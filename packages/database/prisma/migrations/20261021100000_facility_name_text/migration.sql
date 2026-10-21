-- Widen only; never truncate existing facility names or change their identities.
SET lock_timeout = '10s';
ALTER TABLE "master_facilities" ALTER COLUMN "name" TYPE VARCHAR(500);
RESET lock_timeout;
