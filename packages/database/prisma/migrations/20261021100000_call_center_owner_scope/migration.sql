-- Additive, intentionally no historical owner inference or IAM grant backfill.
ALTER TABLE customer_affairs_call_contacts
  ADD COLUMN owner_user_id UUID,
  ADD COLUMN owner_version INTEGER NOT NULL DEFAULT 0,
  ADD CONSTRAINT call_contact_owner_fk FOREIGN KEY (owner_user_id) REFERENCES iam_users(id) ON DELETE RESTRICT,
  ADD CONSTRAINT call_contact_owner_version_check CHECK (owner_version >= 0);
CREATE INDEX call_contact_owner_idx ON customer_affairs_call_contacts(branch_id, owner_user_id);
