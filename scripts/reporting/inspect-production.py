#!/usr/bin/env python3
"""Root-console read-only Reports inventory; emits no business rows or secrets."""
import datetime
import json
import os
from pathlib import Path
import pwd
import subprocess


def command(args, stdin=None):
    result = subprocess.run(args, input=stdin, capture_output=True, text=True, timeout=90)
    if result.returncode:
        raise RuntimeError('Read-only inspection failed: ' + args[0])
    return result.stdout.strip()


def inspect():
    if os.geteuid() != 0:
        raise RuntimeError('Execute explicitly from the existing root console')
    os.umask(0o077)
    compose = ['docker', 'compose', '-f', '/opt/rubi/compose.yaml']
    container = command(compose + ['ps', '-q', 'postgres'])
    if not container or '\n' in container:
        raise RuntimeError('Expected exactly one PostgreSQL service')
    # Resolve credentials inside the container. No environment is returned/logged.
    sql = '''BEGIN READ ONLY;
SET LOCAL statement_timeout = '10s';
SELECT json_build_object('section','database','data',json_build_object(
 'version',current_setting('server_version'),'timezone',current_setting('TimeZone')));
SELECT json_build_object('section','columns','data',coalesce(json_agg(row_to_json(c)), '[]'))
FROM (SELECT table_name,column_name,data_type,is_nullable
 FROM information_schema.columns WHERE table_schema='public'
 ORDER BY table_name,ordinal_position) c;
SELECT json_build_object('section','constraints','data',coalesce(json_agg(row_to_json(c)), '[]'))
FROM (SELECT cl.relname AS table_name,con.conname AS name,con.contype AS type,
 pg_get_constraintdef(con.oid) AS definition
 FROM pg_constraint con JOIN pg_class cl ON cl.oid=con.conrelid
 JOIN pg_namespace ns ON ns.oid=cl.relnamespace
 WHERE ns.nspname='public' ORDER BY cl.relname,con.conname) c;
SELECT format('SELECT json_build_object(''section'',''count'',''table'',%L,''rows'',count(*)) FROM %I.%I;',
 tablename,schemaname,tablename) FROM pg_tables
 WHERE schemaname='public' AND tablename ~ '^(sales_|reservation_|finance_|accounting_|procurement_|customer|marketing_|hr_|automation_|reporting_|ticket_|document)'
 ORDER BY tablename;
\\gexec
ROLLBACK;
'''
    output = command(['docker', 'exec', '-i', container, 'sh', '-c',
        'exec psql -X -qAt -v ON_ERROR_STOP=1 -U "$POSTGRES_USER" -d "$POSTGRES_DB"'], sql)
    sections = [json.loads(line) for line in output.splitlines() if line.startswith('{')]
    receipt = {'generatedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
               'applicationChanges': False, 'databaseWrites': False,
               'businessRowsExported': False, 'sections': sections}
    path = Path('/home/rubi-deploy') / ('reports-source-audit-' +
        datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%SZ') + '.json')
    with path.open('x', encoding='utf-8') as stream:
        json.dump(receipt, stream, ensure_ascii=False, indent=2)
    account = pwd.getpwnam('rubi-deploy')
    os.chown(path, account.pw_uid, account.pw_gid)
    print('Read-only receipt: ' + str(path))
    print('No application/database changes; no business rows or credentials exported.')


if __name__ == '__main__':
    inspect()
