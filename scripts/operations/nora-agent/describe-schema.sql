-- psql -XqAt -v ON_ERROR_STOP=1. Output contains catalog identifiers only.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout='15s';
SELECT json_build_object(
  'schema', n.nspname, 'name', c.relname, 'kind', c.relkind,
  'columns', (SELECT json_object_agg(a.attname,format_type(a.atttypid,a.atttypmod) ORDER BY a.attnum)
              FROM pg_attribute a WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped),
  'keys', (SELECT coalesce(json_agg(pg_get_constraintdef(k.oid) ORDER BY k.conname),'[]'::json)
           FROM pg_constraint k WHERE k.conrelid=c.oid AND k.contype IN ('p','u','f'))
)::text
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname IN ('public','nora_agent') AND c.relkind IN ('r','p','v','m')
ORDER BY n.nspname COLLATE "C",c.relname COLLATE "C";
ROLLBACK;
