CREATE TABLE "correspondence_attachments" (
    "id" UUID NOT NULL,
    "letterId" UUID NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "size" INTEGER NOT NULL,
    "digest" VARCHAR(64) NOT NULL,
    "bytes" BYTEA NOT NULL,
    "ordinal" INTEGER NOT NULL,
    CONSTRAINT "correspondence_attachments_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "correspondence_attachments_letterId_fkey" FOREIGN KEY ("letterId") REFERENCES "correspondence_letters"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "correspondence_attachments_letterId_ordinal_key" ON "correspondence_attachments"("letterId", "ordinal");
