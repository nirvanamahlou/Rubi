ALTER TABLE "TicketPublishedOffer"
  ADD COLUMN "returnMinDays" INTEGER,
  ADD COLUMN "returnMaxDays" INTEGER,
  ADD CONSTRAINT "TicketPublishedOffer_returnWindow_check" CHECK (
    ("returnMinDays" IS NULL OR "returnMinDays" BETWEEN 0 AND 365) AND
    ("returnMaxDays" IS NULL OR "returnMaxDays" BETWEEN 0 AND 365) AND
    ("returnMinDays" IS NULL OR "returnMaxDays" IS NULL OR "returnMinDays" <= "returnMaxDays")
  );
