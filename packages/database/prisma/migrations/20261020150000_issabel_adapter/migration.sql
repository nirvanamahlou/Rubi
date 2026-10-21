CREATE TABLE integration_telephony_commands (
  id UUID PRIMARY KEY,
  "connectionId" UUID NOT NULL REFERENCES integration_telephony_connections(id) ON DELETE RESTRICT,
  "actorUserId" UUID NOT NULL REFERENCES iam_users(id) ON DELETE RESTRICT,
  extension VARCHAR(10) NOT NULL CHECK (extension ~ '^[0-9]{2,10}$'),
  "encryptedDestination" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL CHECK ("keyVersion" > 0),
  fingerprint CHAR(64) NOT NULL,
  state VARCHAR(16) NOT NULL DEFAULT 'QUEUED' CHECK (state IN ('QUEUED','DISPATCHING','ACCEPTED','SUCCEEDED','FAILED','UNKNOWN','EXPIRED')),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "dispatchedAt" TIMESTAMPTZ(3),
  "updatedAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX integration_telephony_commands_state_createdAt_idx ON integration_telephony_commands(state,"createdAt");

CREATE TABLE integration_telephony_recordings (
  id UUID PRIMARY KEY,
  "connectionId" UUID NOT NULL REFERENCES integration_telephony_connections(id) ON DELETE RESTRICT,
  "rootFingerprint" CHAR(64) NOT NULL,
  "encryptedMetadata" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL CHECK ("keyVersion" > 0),
  sha256 CHAR(64) NOT NULL,
  "sizeBytes" INTEGER NOT NULL CHECK ("sizeBytes" BETWEEN 44 AND 20971520),
  state VARCHAR(16) NOT NULL DEFAULT 'UPLOADING' CHECK (state IN ('UPLOADING','COMPLETE')),
  "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "expiresAt" TIMESTAMPTZ(3) NOT NULL,
  "completedAt" TIMESTAMPTZ(3)
);
CREATE INDEX integration_telephony_recordings_expiresAt_idx ON integration_telephony_recordings("expiresAt");
CREATE TABLE integration_telephony_recording_chunks (
  "recordingId" UUID NOT NULL REFERENCES integration_telephony_recordings(id) ON DELETE CASCADE,
  index INTEGER NOT NULL CHECK (index BETWEEN 0 AND 639),
  "encryptedAudio" TEXT NOT NULL,
  "keyVersion" INTEGER NOT NULL CHECK ("keyVersion" > 0),
  fingerprint CHAR(64) NOT NULL,
  PRIMARY KEY ("recordingId",index)
);
