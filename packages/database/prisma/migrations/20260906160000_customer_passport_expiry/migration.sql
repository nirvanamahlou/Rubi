-- Nullable, additive metadata: existing customer identity ciphertext is unchanged.
ALTER TABLE "customers" ADD COLUMN "passportExpiryDate" DATE;
