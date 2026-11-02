#!/usr/bin/env python3
"""Retry only isolated validation of the already built, source-verified candidate."""
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import time

ROOT=Path('/opt/rubi')
BASE='rubi-production:b5ce75bcc97a0c34cf8563aa18b0280634d23ad9'
IMAGE='rubi-production:call-center-answered-1029-b5'
WORK=ROOT/'call-center-live-verify-1029'
REPORT=ROOT/'CALL-CENTER-LIVE-BUILD-1029.json'
PG='rubi-call-center-live-pg-1029'
CHECK='rubi-call-center-live-checks-1029'


def run(args,timeout=30,input=None):
    p=subprocess.run(args,capture_output=True,timeout=timeout,input=input)
    if p.returncode:
        (WORK/'failure.log').write_bytes(p.stdout+p.stderr)
        raise RuntimeError('Command failed: '+' '.join(args[:3])+' exit='+str(p.returncode))
    return p.stdout.decode(errors='replace')


def snapshot():
    result={}
    for service in ('api','web','worker','postgres','redis'):
        item=json.loads(run(['docker','inspect','rubi-production-'+service+'-1']))[0]
        if not item['State']['Running']: raise RuntimeError('Live service unavailable')
        if service in ('api','web','worker') and item['Config']['Image']!=BASE:
            raise RuntimeError('Live release changed')
        result[service]=item['Id']
    result['compose']=hashlib.sha256((ROOT/'compose.yaml').read_bytes()).hexdigest()
    return result


def save(report):
    path=ROOT/'.call-center-live-verify-1029.tmp'
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
    with os.fdopen(fd,'w') as stream: json.dump(report,stream,indent=2)
    os.chmod(path,0o644);os.replace(path,REPORT)


def main():
    if os.geteuid()!=0: raise SystemExit('Run as root')
    os.umask(0o077)
    if WORK.exists(): raise SystemExit('Existing verification requires inspection')
    prior=json.loads(REPORT.read_text())
    if (prior.get('stage')!='failed' or prior.get('live_containers_preserved') is not True or
        'Disposable nora_ci' not in prior.get('diagnostic_tail','')):
        raise SystemExit('Expected inspected test topology failure')
    with open(ROOT/'avina-deploy.lock','r') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        before=snapshot()
        for name in (PG,CHECK):
            if subprocess.run(['docker','container','inspect',name],capture_output=True).returncode==0:
                raise SystemExit('Existing test container requires inspection')
        WORK.mkdir(mode=0o700)
        (WORK/'previous-receipt.json').write_text(json.dumps(prior,indent=2))
        report={'complete':False,'application_changes':False,'business_data_changes':False,'base':BASE,
                'candidate':IMAGE,'stage':'source_verification','typecheck_and_api_build_passed':True,
                'time_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
        password=secrets.token_urlsafe(32);pg_created=False
        try:
            manifest=json.loads((ROOT/'call-center-live-build-retry1-1029/overlay-manifest.json').read_text(encoding='utf-8-sig'))
            code="const fs=require('fs'),crypto=require('crypto');let s='';process.stdin.on('data',b=>s+=b);process.stdin.on('end',()=>{for(const f of JSON.parse(s)){if(crypto.createHash('sha256').update(fs.readFileSync('/workspace/'+f.path)).digest('hex')!==f.sha256)throw Error('Source mismatch')}console.log('SOURCE_VERIFIED')});"
            run(['docker','run','--rm','--network','none','-i','--entrypoint','node',IMAGE,'-e',code],input=json.dumps(manifest).encode())
            report['candidate_image_id']=json.loads(run(['docker','image','inspect',IMAGE]))[0]['Id']
            report['source_verified']=True;report['stage']='isolated_database';save(report)
            pg_env=WORK/'postgres.env';pg_env.write_text('POSTGRES_USER=nora_ci\nPOSTGRES_DB=nora_ci\nPOSTGRES_PASSWORD='+password+'\n')
            run(['docker','run','-d','--name',PG,'--network','none','--env-file',str(pg_env),'postgres:18.1-alpine']);pg_created=True
            for _ in range(40):
                if subprocess.run(['docker','exec',PG,'pg_isready','-U','nora_ci','-d','nora_ci'],capture_output=True).returncode==0: break
                time.sleep(1)
            else: raise RuntimeError('Disposable database not ready')
            test_env=WORK/'test.env';test_env.write_text('NODE_ENV=test\nDATABASE_URL=postgresql://nora_ci:'+password+'@127.0.0.1:5432/nora_ci\nNORA_RUN_CALL_CENTER_POSTGRES_TESTS=1\nISSABEL_ENABLED=false\nNO_COLOR=1\n')
            # Share only this isolated PostgreSQL container's network namespace.
            # It has no external network or host port; test URL stays loopback.
            prefix=['docker','run','--rm','--name',CHECK,'--network','container:'+PG,'--env-file',str(test_env),'--entrypoint','pnpm',IMAGE]
            run(prefix+['--filter','@nora/database','exec','prisma','migrate','deploy'],timeout=300)
            report['stage']='tests';save(report)
            output=run(prefix+['--filter','@nora/api','exec','vitest','run','src/customer-affairs/call-center',
                              'src/integrations/issabel','src/hr/hr-call-answer-directory','src/iam/iam-call-request-assignees',
                              '--maxWorkers=1'],timeout=900)
            (WORK/'tests.log').write_text(output)
            report['test_summary']=[line.strip() for line in output.splitlines() if 'Test Files' in line or 'Tests ' in line][-3:]
            if snapshot()!=before: raise RuntimeError('Live deployment changed')
            report.update(complete=True,stage='candidate_validated')
        except Exception as error:
            report.update(stage='failed',failure=str(error)[:300],failure_type=type(error).__name__)
            if (WORK/'failure.log').exists():
                report['diagnostic_tail']=(WORK/'failure.log').read_text(errors='replace')[-7000:].replace(password,'[REDACTED]')
        finally:
            subprocess.run(['docker','rm','-f',CHECK],capture_output=True)
            if pg_created: subprocess.run(['docker','rm','-f','-v',PG],capture_output=True)
            for name in ('postgres.env','test.env'): (WORK/name).unlink(missing_ok=True)
            report['live_containers_preserved']=snapshot()==before
            save(report)
        print('PASS: candidate validation complete; live ERP unchanged.' if report['complete'] else 'INCOMPLETE: inspect receipt; live ERP unchanged.')
        print('Receipt: '+str(REPORT))
        return 0 if report['complete'] else 1


if __name__=='__main__': raise SystemExit(main())
