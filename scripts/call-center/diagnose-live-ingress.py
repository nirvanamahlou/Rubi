#!/usr/bin/env python3
"""Read-only activation diagnosis; export no credentials or call payloads."""
import datetime
import json
import os
from pathlib import Path
import pwd
import re
import subprocess


def capture(args):
    result = subprocess.run(args, capture_output=True, text=True, timeout=30)
    if result.returncode:
        raise RuntimeError('Read-only diagnostic command failed')
    return result.stdout


def redact(text, values):
    for value in sorted(set(values), key=len, reverse=True):
        if len(value) >= 6:
            text = text.replace(value, '[REDACTED]')
    text = re.sub(r'(?i)(?:postgres(?:ql)?|https?)://[^\s\x22\x27]+', '[REDACTED_URL]', text)
    text = re.sub(r'(?im)^.*(?:password|secret|token|private.key)\s*[:=].*$', '[REDACTED_LINE]', text)
    return text[-10000:]


def main():
    if os.geteuid() != 0:
        raise SystemExit('Run as root; no service or database is modified')
    os.umask(0o077)
    api = json.loads(capture(['docker', 'inspect', 'rubi-production-api-1']))[0]
    environment = dict(item.split('=', 1) for item in api['Config']['Env'])
    work = Path('/opt/rubi/private/call-center-live-ingress-retry-1031')
    failure = work/'failure.log'
    # Fixed queries only; READ ONLY and statement timeout apply to all statements.
    query = '''BEGIN READ ONLY; SET LOCAL statement_timeout='8000ms';
SELECT json_build_object(
 'applied', (SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
 'unfinished', (SELECT coalesce(json_agg(json_build_object('name',migration_name,'started',started_at,'rolled_back',rolled_back_at,'logs',logs)), '[]'::json) FROM _prisma_migrations WHERE finished_at IS NULL),
 'answer_table', to_regclass('public.call_center_answer_responsibilities')::text,
 'roles', (SELECT json_agg(json_build_object('name',rolname,'superuser',rolsuper,'create_db',rolcreatedb)) FROM pg_roles WHERE rolname IN ('rubi','rubi_app'))
); COMMIT;'''
    state = json.loads(capture(['docker', 'exec', 'rubi-production-postgres-1', 'psql', '-X', '-U', 'rubi', '-d', 'rubi', '-qAt', '-v', 'ON_ERROR_STOP=1', '-c', query]))
    report = {
        'time_utc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'application_changes': False, 'database_changes': False,
        'api_image': api['Config']['Image'],
        'api_running': api['State']['Running'],
        'collector_enabled': environment.get('ISSABEL_ENABLED') == 'true',
        'database_state': state,
        'failure_log': failure.read_text(errors='replace') if failure.exists() else 'Missing',
        'bootstrap_error': (work/'apply-error.log').read_text(errors='replace') if (work/'apply-error.log').exists() else 'Missing',
        'vpn_active': capture(['systemctl', 'is-active', 'rubi-issabel-vpn']).strip(),
        'tls_active': capture(['systemctl', 'is-active', 'rubi-issabel-tls']).strip(),
    }
    # Redact individual log strings, preserving the structured evidence fields.
    sensitive = [value for key, value in environment.items()
                 if any(word in key for word in ('SECRET', 'PASSWORD', 'TOKEN', 'KEY', 'DATABASE_URL'))]
    report['failure_log'] = redact(report['failure_log'], sensitive)
    report['bootstrap_error'] = redact(report['bootstrap_error'], sensitive)
    for migration in state['unfinished']:
        migration['logs'] = redact(migration['logs'] or '', sensitive)
    target = Path('/home/rubi-deploy/call-center-live-diagnosis-1031b.json')
    fd = os.open(target, os.O_WRONLY | os.O_CREAT | os.O_EXCL | os.O_NOFOLLOW, 0o600)
    account = pwd.getpwnam('rubi-deploy')
    with os.fdopen(fd, 'w') as stream:
        json.dump(report, stream, indent=2)
        os.fchown(stream.fileno(), account.pw_uid, account.pw_gid)
    print('Read-only diagnosis complete: ' + str(target))


if __name__ == '__main__':
    main()
