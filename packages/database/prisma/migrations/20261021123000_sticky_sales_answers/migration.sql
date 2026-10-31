CREATE TABLE integration_telephony_answers (
  id UUID PRIMARY KEY,
  "connectionId" UUID NOT NULL REFERENCES integration_telephony_connections(id) ON DELETE RESTRICT,
  "inboxId" UUID NOT NULL UNIQUE REFERENCES integration_telephony_inbox(id) ON DELETE RESTRICT,
  queue VARCHAR(100) NOT NULL,
  "phoneFingerprint" CHAR(64),
  "answeredAt" TIMESTAMPTZ(3) NOT NULL,
  "encryptedAnswer" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL CHECK ("keyVersion" > 0),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX telephony_answer_lookup_idx ON integration_telephony_answers
  ("connectionId", queue, "phoneFingerprint", "answeredAt" DESC, id DESC);
