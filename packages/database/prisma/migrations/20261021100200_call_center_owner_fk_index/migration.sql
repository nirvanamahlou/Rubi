-- FK lookup for safe user deletion checks; branch/owner index serves scoped lists.
CREATE INDEX call_contact_owner_user_idx ON customer_affairs_call_contacts(owner_user_id);
