#!/usr/bin/python3
"""Read-only live ERP Call Center audit. No credentials, calls or HR payload output."""
import base64
import datetime
import fcntl
import json
import os
from pathlib import Path
import pwd
import socket
import subprocess
import sys
import urllib.error
import urllib.request

def capture(args, timeout=30):
    result = subprocess.run(args, capture_output=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError('Diagnostic command failed: ' + args[0])
    return result.stdout.decode()

def environment(item):
    return dict(row.split('=', 1) for row in item['Config'].get('Env', []) if '=' in row)

def key_valid(env, name):
    try:
        return len(base64.b64decode(env.get(name, ''), validate=True)) == 32
    except Exception:
        return False

SQL = """SELECT json_build_object(
 'contacts',(SELECT count(*) FROM customer_affairs_call_contacts),
 'calls',(SELECT count(*) FROM customer_affairs_calls),
 'telephony_calls',(SELECT count(*) FROM customer_affairs_calls WHERE origin='TELEPHONY'),
 'real_sessions',(SELECT count(*) FROM call_center_telephony_sessions WHERE NOT synthetic),
 'open_real_sessions',(SELECT count(*) FROM call_center_telephony_sessions WHERE NOT synthetic AND state<>'ENDED'),
 'connections',(SELECT count(*) FROM integration_telephony_connections WHERE NOT synthetic),
 'active_connections',(SELECT count(*) FROM integration_telephony_connections WHERE NOT synthetic AND active),
 'active_mappings',(SELECT count(*) FROM integration_telephony_mappings WHERE active),
 'recordings',(SELECT count(*) FROM integration_telephony_recordings),
 'incomplete_recordings',(SELECT count(*) FROM integration_telephony_recordings WHERE state='UPLOADING'),
 'pending_outbox',(SELECT count(*) FROM integration_telephony_outbox WHERE "completedAt" IS NULL),
 'inbox_statuses',(SELECT coalesce(json_object_agg(status,total),'{}'::json) FROM
    (SELECT status,count(*) total FROM integration_telephony_inbox GROUP BY status) x),
 'users_with_unit',(SELECT count(*) FROM iam_user_profiles WHERE organization_unit_id IS NOT NULL),
 'employees_linked_to_accounts',(SELECT count(*) FROM hr_employees WHERE user_id IS NOT NULL AND deleted_at IS NULL),
 'approved_account_presence',(SELECT coalesce(json_object_agg(username,status),'{}'::json) FROM iam_users
    WHERE username IN ('danial','demo')),
 'successful_migrations',(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL),
 'unfinished_migrations',(SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL)
);"""

IDENTITY_SQL = """SELECT json_build_object(
 'branches',(SELECT json_agg(x) FROM (SELECT id,code,name,"isActive" FROM branches ORDER BY code LIMIT 100) x),
 'accounts',(SELECT json_agg(x) FROM (SELECT u.id,u.username,u."displayName",u.status,
   p.organization_unit_id AS unit_id,
   (SELECT json_agg(b."branchId") FROM iam_user_branches b WHERE b."userId"=u.id) AS branches,
   (SELECT json_agg(DISTINCT q.code) FROM iam_user_roles ur JOIN iam_roles r ON r.id=ur."roleId" AND r."isActive"
     JOIN iam_role_permissions rp ON rp."roleId"=r.id JOIN iam_permissions q ON q.id=rp."permissionId"
     WHERE ur."userId"=u.id AND (q.code LIKE '%call_center%' OR q.code LIKE '%telephony%' OR q.code LIKE '%customer-affairs%')) AS call_permissions
   FROM iam_users u LEFT JOIN iam_user_profiles p ON p.user_id=u.id ORDER BY u.username LIMIT 500) x),
 'extensions',(SELECT json_agg(x) FROM (SELECT e.id AS employee_id,e.user_id,e.branch_id,e.status,
   r."values"->>0 AS extension FROM hr_employees e JOIN hr_records r ON r.employee_id=e.id
   WHERE e.deleted_at IS NULL AND r.deleted_at IS NULL AND r.section='employee' AND r.tab='internalContact'
   ORDER BY e.id LIMIT 1000) x),
 'units',(SELECT json_agg(x) FROM (SELECT id,branch_id,status,"values"->>0 AS name FROM hr_records
   WHERE section='organization' AND tab='units' AND deleted_at IS NULL LIMIT 200) x),
 'connections',(SELECT json_agg(x) FROM (SELECT id,"branchId",active,synthetic FROM integration_telephony_connections LIMIT 100) x),
 'answer_policy_table',to_regclass('public.call_center_answer_responsibilities') IS NOT NULL
);"""

def audit(report):
    raw = capture(['docker','compose','-f','/opt/rubi/compose.yaml','ps','--all','--format','json'])
    rows = json.loads(raw) if raw.lstrip().startswith('[') else [json.loads(x) for x in raw.splitlines() if x]
    services = {x['Service']: x for x in rows}
    report['containers'] = {name: {'image': row['Image'], 'state': row['State']} for name,row in services.items()}
    inspected = json.loads(capture(['docker','inspect',services['api']['Name'],services['worker']['Name']]))
    api = environment(inspected[0]); worker = environment(inspected[1])
    report['configuration'] = {
        'issabel_enabled': api.get('ISSABEL_ENABLED') == 'true',
        'ami_host_present': bool(api.get('ISSABEL_AMI_HOST')),
        'ami_username_present': bool(api.get('ISSABEL_AMI_USERNAME')),
        'ami_secret_present': bool(api.get('ISSABEL_AMI_SECRET')),
        'connection_id_present': bool(api.get('ISSABEL_CONNECTION_ID')),
        'native_mode': api.get('ISSABEL_EVENT_MODE') == 'NATIVE_QUEUE_CAPTURE',
        'company_scope': api.get('ISSABEL_CAPTURE_SCOPE') == 'COMPANY',
        'company_extensions_present': bool(api.get('ISSABEL_COMPANY_EXTENSIONS')),
        'inbound_peers_present': bool(api.get('ISSABEL_INBOUND_PEERS')),
        'outbound_peers_present': bool(api.get('ISSABEL_OUTBOUND_PEERS')),
        'worker_secret_valid_and_matches': len(api.get('TELEPHONY_WORKER_SECRET','')) >= 32
            and api.get('TELEPHONY_WORKER_SECRET') == worker.get('TELEPHONY_WORKER_SECRET'),
        'worker_api_url_present': bool(worker.get('TELEPHONY_API_URL')),
        'contact_encryption_key_valid': key_valid(api,'CUSTOMER_CONTACT_ENCRYPTION_KEY_BASE64'),
        'contact_fingerprint_key_valid': key_valid(api,'CUSTOMER_CONTACT_FINGERPRINT_KEY_BASE64'),
        'recording_secret_present': bool(api.get('ISSABEL_RECORDING_UPLOAD_SECRET')),
        'recording_retention_present': bool(api.get('ISSABEL_RECORDING_RETENTION_DAYS')),
        'recovery_switch_enabled': api.get('ISSABEL_RECOVERY_ENABLED') == 'true',
    }
    sql = "BEGIN READ ONLY; SET LOCAL statement_timeout='8000ms'; " + SQL + ' COMMIT;'
    output = capture(['docker','exec',services['postgres']['Name'],'psql','-X','-U','rubi','-d','rubi',
        '-v','ON_ERROR_STOP=1','-qAtc',sql], timeout=45)
    report['database'] = json.loads(output.strip())
    identity_sql = "BEGIN READ ONLY; SET LOCAL statement_timeout='8000ms'; " + IDENTITY_SQL + ' COMMIT;'
    output = capture(['docker','exec',services['postgres']['Name'],'psql','-X','-U','rubi','-d','rubi',
        '-v','ON_ERROR_STOP=1','-qAtc',identity_sql], timeout=45)
    report['identity_readiness'] = json.loads(output.strip())
    report['runtime_gates'] = {
        'access_policy': api.get('CALL_CENTER_ACCESS_POLICY', 'DEFAULT'),
        'global_account_allowlist_present': bool(api.get('CALL_CENTER_GLOBAL_USER_IDS')),
        'native_notifications_enabled': api.get('ISSABEL_USER_NOTIFICATIONS_ENABLED') == 'true',
        'relay_enabled': api.get('TELEPHONY_EVENT_RELAY_ENABLED') == 'true',
    }
    report['company_pbx_tcp'] = {}
    for port in (5038,5039,22):
        try:
            with socket.create_connection(('192.168.100.200',port),timeout=3):
                report['company_pbx_tcp'][str(port)] = 'CONNECTED'
        except Exception as exc:
            report['company_pbx_tcp'][str(port)] = type(exc).__name__
    report['anonymous_http'] = {}
    for path in ('integrations/telephony/health','integrations/telephony/issabel/status',
        'customer-affairs/call-center/branches','customer-affairs/call-center/telephony'):
        try:
            with urllib.request.urlopen('https://avinaofficial.ir/api/v1/'+path,timeout=10) as response:
                status = response.status
        except urllib.error.HTTPError as exc:
            status = exc.code
        report['anonymous_http'][path] = status
    report['complete'] = True

def main():
    if os.geteuid() or len(sys.argv) != 1:
        raise SystemExit('Run as root without arguments')
    os.umask(0o077)
    report = {'complete': False, 'application_changes': False, 'business_data_changes': False}
    try:
        with open('/opt/rubi/avina-deploy.lock','r') as lock:
            fcntl.flock(lock,fcntl.LOCK_SH|fcntl.LOCK_NB)
            audit(report)
    except Exception as exc:
        report['error'] = type(exc).__name__
    account = pwd.getpwnam('rubi-deploy')
    stamp = datetime.datetime.now(datetime.timezone.utc).strftime('%Y%m%dT%H%M%S%fZ')
    destination = Path('/home/rubi-deploy/call-center-live-preflight-'+stamp+'.json')
    fd = os.open(destination,os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW|os.O_WRONLY,0o600)
    with os.fdopen(fd,'w') as stream:
        json.dump(report,stream,indent=2)
        os.fchown(stream.fileno(),account.pw_uid,account.pw_gid)
    print('Call Center audit receipt: '+str(destination))
    print('COMPLETE' if report['complete'] else 'INCOMPLETE')

if __name__ == '__main__':
    main()
