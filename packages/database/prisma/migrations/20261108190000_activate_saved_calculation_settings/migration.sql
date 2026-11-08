BEGIN;
-- The status-less calculation-settings editor persisted configured records as drafts.
-- Repair only validated legacy drafts with an existing auditable editor; never inactive settings.
WITH candidates AS (
 SELECT r.id, a.actor_id FROM hr_records r
 JOIN LATERAL (SELECT actor_id FROM hr_audit_events WHERE record_id=r.id ORDER BY created_at DESC,id DESC LIMIT 1) a ON true
 WHERE r.section='time' AND r.tab='calculationSettings' AND r.status='پیش‌نویس' AND r.deleted_at IS NULL
 AND jsonb_typeof(r.values)='array' AND jsonb_array_length(r.values)=10
 AND r.values->>2 IN ('بله','خیر') AND r.values->>3 ~ '^[0-9]{1,4}$'
 AND CASE WHEN r.values->>3 ~ '^[0-9]{1,4}$' THEN (r.values->>3)::integer BETWEEN 1 AND 1440 ELSE false END
 AND r.values->>9 IN ('حکم','تردد')
 AND NOT EXISTS (SELECT 1 FROM hr_records active WHERE active.branch_id=r.branch_id AND active.section='time' AND active.tab='calculationSettings' AND active.status='فعال' AND active.deleted_at IS NULL)
), changed AS (
 UPDATE hr_records r SET status='فعال',version=r.version+1,updated_at=now() FROM candidates c WHERE r.id=c.id
 RETURNING r.id,r.branch_id,r.version,c.actor_id
)
INSERT INTO hr_audit_events(id,branch_id,actor_id,record_id,action,version,from_status,to_status,changes)
SELECT gen_random_uuid(),branch_id,actor_id,id,'CALCULATION_SETTINGS_REPAIR',version,'پیش‌نویس','فعال',jsonb_build_object('reason','Repair status-less calculation settings editor default') FROM changed;
COMMIT;
