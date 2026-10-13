-- Independent insurers no longer require a Master Organization. Existing
-- organization links, their uniqueness, and the restrictive foreign key stay
-- intact for legacy records and v1 clients.
ALTER TABLE "master_insurers"
ALTER COLUMN "organizationId" DROP NOT NULL;
