-- MASTER-003J-INSURANCE hardening: align the existing insurer catalog with optimistic locking constraints.
ALTER TABLE "master_insurers"
  ADD CONSTRAINT "master_insurers_version_check" CHECK ("version" >= 1);
