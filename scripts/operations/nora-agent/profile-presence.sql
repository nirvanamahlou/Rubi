-- psql -XqAt -v ON_ERROR_STOP=1. One existence test per physical table.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '3s';
SET LOCAL lock_timeout = '500ms';
SELECT format('SELECT json_build_object(''table'', %L, ''populated'', EXISTS (SELECT 1 FROM %I.%I LIMIT 1))::text', c.relname, n.nspname, c.relname)
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relkind IN ('r','p')
ORDER BY c.relname COLLATE "C"
\gexec
ROLLBACK;
