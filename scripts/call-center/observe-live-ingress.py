#!/usr/bin/env python3
"""Bounded20-minute read-only acceptance counters. Never prints call payloads."""
import datetime
import json
import os
from pathlib import Path
import subprocess
import sys
import time
import uuid

ROOT=Path('/opt/rubi')
OUTPUT=ROOT/'CALL-CENTER-LIVE-PROOF-1029.json'


def query(connection):
    key=str(uuid.UUID(connection))
    return '''BEGIN READ ONLY; SET LOCAL statement_timeout='8000ms';
SELECT json_build_object(
 'real_sessions',(SELECT count(*) FROM call_center_telephony_sessions WHERE "connectionId"='%s'::uuid AND NOT synthetic),
 'persisted_calls',(SELECT count(*) FROM customer_affairs_calls c JOIN call_center_telephony_sessions s ON s."callId"=c.id WHERE s."connectionId"='%s'::uuid AND NOT s.synthetic AND c.origin='TELEPHONY'),
 'ended_sessions',(SELECT count(*) FROM call_center_telephony_sessions WHERE "connectionId"='%s'::uuid AND NOT synthetic AND state='ENDED'),
 'answer_responsibilities',(SELECT count(*) FROM call_center_answer_responsibilities a JOIN call_center_telephony_sessions s ON s."callId"=a."callId" WHERE s."connectionId"='%s'::uuid AND NOT s.synthetic),
 'ended_answered_calls',(SELECT count(DISTINCT a."callId") FROM call_center_answer_responsibilities a JOIN call_center_telephony_sessions s ON s."callId"=a."callId" WHERE s."connectionId"='%s'::uuid AND NOT s.synthetic AND s.state='ENDED'),
 'inbox_statuses',(SELECT coalesce(json_object_agg(status,total),'{}'::json) FROM (SELECT status,count(*) total FROM integration_telephony_inbox WHERE "connectionId"='%s'::uuid GROUP BY status) x),
 'pending_outbox',(SELECT count(*) FROM integration_telephony_outbox o JOIN integration_telephony_inbox i ON i.id=o."inboxId" WHERE i."connectionId"='%s'::uuid AND o."completedAt" IS NULL),
 'last_transition',(SELECT action FROM integration_telephony_audit WHERE "connectionId"='%s'::uuid AND action IN ('AMI_CONNECTED','AMI_GAP','AMI_STOPPED') ORDER BY "createdAt" DESC,id DESC LIMIT 1)
); COMMIT;''' % ((key,)*8)


def main():
    if os.geteuid()!=0 or len(sys.argv)!=2: raise SystemExit('Root and configured connection UUID required')
    sql=query(sys.argv[1]);os.umask(0o077)
    deadline=time.monotonic()+1200
    while time.monotonic()<deadline:
        result=subprocess.run(['docker','exec','rubi-production-postgres-1','psql','-X','-U','rubi','-d','rubi','-qAt',
                               '-v','ON_ERROR_STOP=1','-c',sql],capture_output=True,timeout=15)
        if result.returncode!=0: raise SystemExit('Read-only acceptance query failed')
        report=json.loads(result.stdout)
        report['time_utc']=datetime.datetime.now(datetime.timezone.utc).isoformat()
        report['state']='WAITING_REAL_CALL' if not report['persisted_calls'] else 'REAL_CALL_PERSISTED'
        failed=any(count for status,count in report['inbox_statuses'].items() if status not in ('DONE','PENDING','PROCESSING'))
        if report['ended_answered_calls'] and not failed and not report['pending_outbox']:
            report['state']='ANSWERED_CALL_VERIFIED'
        path=ROOT/'.call-center-live-proof-1029.tmp'
        fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
        with os.fdopen(fd,'w') as stream: json.dump(report,stream,indent=2)
        os.chmod(path,0o644);os.replace(path,OUTPUT)
        if report['state']=='ANSWERED_CALL_VERIFIED': return
        time.sleep(5)


if __name__=='__main__': main()
