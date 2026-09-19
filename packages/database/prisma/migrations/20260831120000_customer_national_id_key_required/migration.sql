-- Additive hardening: SQL CHECK treats UNKNOWN as accepted. Require the
-- encryption key version explicitly whenever national-ID ciphertext exists.
-- Historical national-ID migration is intentionally left unchanged.
ALTER TABLE "customers"
  ADD CONSTRAINT "customers_national_id_key_required_check" CHECK (
    "nationalIdEncrypted" IS NULL OR "nationalIdKeyVersion" IS NOT NULL
  );
