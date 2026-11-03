ALTER TABLE "documents" ADD COLUMN "sender_name" VARCHAR(200), ADD COLUMN "is_incoming_letter" BOOLEAN NOT NULL DEFAULT false;
