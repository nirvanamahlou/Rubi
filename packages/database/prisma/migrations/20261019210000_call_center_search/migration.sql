ALTER TABLE customer_affairs_calls
 ADD COLUMN search_tokens text[] NOT NULL DEFAULT '{}',
 ADD COLUMN source_token char(64), ADD COLUMN unit_token char(64),
 ADD COLUMN needs_completion boolean,
 ADD COLUMN search_version integer NOT NULL DEFAULT 0;
CREATE INDEX cc_search_tokens_idx ON customer_affairs_calls USING gin(search_tokens);
CREATE INDEX cc_call_registered_idx ON customer_affairs_calls(created_at,id);
CREATE INDEX cc_call_report_idx ON customer_affairs_calls(occurred_at,direction,outcome);
