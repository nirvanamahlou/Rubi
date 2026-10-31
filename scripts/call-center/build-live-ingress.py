#!/usr/bin/env python3
"""Build/test reviewed Call Center overlay without changing live containers or DB."""
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import secrets
import subprocess
import tarfile

BASE = 'rubi-production:b5ce75bcc97a0c34cf8563aa18b0280634d23ad9'
IMAGE = 'rubi-production:call-center-answered-1029-b5'
ARCHIVE = Path('/home/rubi-deploy/call-center-live-overlay-1029.tar')
ARCHIVE_SHA = '1961f673f925d7652e5310ef0f8e9c7b46a798639bee6828d58d5d2264dcb957'
ROOT = Path('/opt/rubi')
WORK = ROOT / 'call-center-live-build-retry1-1029'
NETWORK = 'rubi-call-center-live-test-1029'
PG = 'rubi-call-center-live-pg-1029'
CHECK = 'rubi-call-center-live-checks-1029'
REPORT = ROOT / 'CALL-CENTER-LIVE-BUILD-1029.json'


def run(args, timeout=60, env=None):
    p = subprocess.run(args, capture_output=True, timeout=timeout, env=env)
    if p.returncode:
        # All build/test output comes from isolated source/synthetic database.
        (WORK / 'failure.log').write_bytes(p.stdout + p.stderr)
        raise RuntimeError('Failed: ' + ' '.join(args[:3]) + ' exit=' + str(p.returncode))
    return p.stdout.decode(errors='replace')


def snapshot():
    result = {}
    for name in ('api','web','worker','postgres','redis'):
        item=json.loads(run(['docker','inspect','rubi-production-'+name+'-1']))[0]
        if not item['State']['Running']: raise RuntimeError('Live service not running: '+name)
        if name in ('api','web','worker') and item['Config']['Image'] != BASE:
            raise RuntimeError('Live image changed: '+name)
        result[name]=item['Id']
    result['compose']=hashlib.sha256((ROOT/'compose.yaml').read_bytes()).hexdigest()
    return result


def receipt(report):
    tmp=ROOT/'.call-center-live-build-1029.tmp'
    fd=os.open(tmp,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o644)
    with os.fdopen(fd,'w') as stream: json.dump(report,stream,indent=2)
    os.chmod(tmp,0o644);os.replace(tmp,REPORT)


def main():
    if os.geteuid()!=0: raise SystemExit('Run as root')
    os.umask(0o077)
    if WORK.exists(): raise SystemExit('Existing build requires inspection')
    prior=json.loads(REPORT.read_text()) if REPORT.exists() else None
    if not prior or prior.get('stage')!='failed' or prior.get('live_containers_preserved') is not True or 'heap out of memory' not in prior.get('diagnostic_tail',''):
        raise SystemExit('Expected inspected memory-limited build failure')
    available=next(int(line.split()[1]) for line in Path('/proc/meminfo').read_text().splitlines() if line.startswith('MemAvailable:'))
    if available < 5632*1024: raise SystemExit('At least 5.5 GiB available memory required for isolated build')
    if hashlib.sha256(ARCHIVE.read_bytes()).hexdigest()!=ARCHIVE_SHA:
        raise SystemExit('Source archive changed')
    with open(ROOT/'avina-deploy.lock','r') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        before=snapshot()
        for kind,name in [('container',PG),('container',CHECK),('network',NETWORK),('image',IMAGE)]:
            if subprocess.run(['docker',kind,'inspect',name],capture_output=True).returncode==0:
                raise SystemExit('Existing build resource requires inspection: '+name)
        WORK.mkdir(mode=0o700)
        (WORK/'previous-receipt.json').write_text(json.dumps(prior,indent=2))
        report={'complete':False,'application_changes':False,'business_data_changes':False,
                'base':BASE,'candidate':IMAGE,'stage':'extract','time_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
        network_created=False;pg_created=False;password=None
        try:
            with tarfile.open(ARCHIVE) as archive:
                for member in archive.getmembers():
                    parts=Path(member.name).parts
                    if member.isdir(): continue
                    if not member.isfile() or member.name.startswith('/') or '..' in parts:
                        raise RuntimeError('Invalid archive member')
                    if not (member.name.startswith('apps/api/') or member.name.startswith('packages/database/prisma/') or
                            member.name in ('Dockerfile','overlay-manifest.json')):
                        raise RuntimeError('Unapproved overlay path')
                    target=WORK/member.name;target.parent.mkdir(parents=True,exist_ok=True)
                    with archive.extractfile(member) as source:
                        data=source.read()
                    fd=os.open(target,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,0o600)
                    with os.fdopen(fd,'wb') as output: output.write(data)
            manifest=json.loads((WORK/'overlay-manifest.json').read_text(encoding='utf-8-sig'))
            for item in manifest:
                if hashlib.sha256((WORK/item['path']).read_bytes()).hexdigest()!=item['sha256']:
                    raise RuntimeError('Overlay file hash mismatch')
            report['stage']='build';receipt(report)
            run(['docker','build','--network','none','-t',IMAGE,str(WORK)],timeout=1200)
            report['stage']='isolated_database';receipt(report)
            run(['docker','network','create','--internal',NETWORK]);network_created=True
            password=secrets.token_urlsafe(32)
            pg_env=WORK/'postgres.env';pg_env.write_text('POSTGRES_USER=nora_ci\nPOSTGRES_DB=nora_ci\nPOSTGRES_PASSWORD='+password+'\n')
            run(['docker','run','-d','--name',PG,'--network',NETWORK,'--env-file',str(pg_env),'postgres:18.1-alpine']);pg_created=True
            import time
            for _ in range(40):
                if subprocess.run(['docker','exec',PG,'pg_isready','-U','nora_ci','-d','nora_ci'],capture_output=True).returncode==0: break
                time.sleep(1)
            else: raise RuntimeError('Isolated database not ready')
            test_env=WORK/'test.env'
            test_env.write_text('NODE_ENV=test\nDATABASE_URL=postgresql://nora_ci:'+password+'@'+PG+':5432/nora_ci\nNORA_RUN_CALL_CENTER_POSTGRES_TESTS=1\nISSABEL_ENABLED=false\n')
            prefix=['docker','run','--rm','--name',CHECK,'--network',NETWORK,'--env-file',str(test_env),'--entrypoint','pnpm',IMAGE]
            run(prefix+['--filter','@nora/database','exec','prisma','migrate','deploy'],timeout=300)
            report['stage']='tests';receipt(report)
            # Vitest filters select Call Center and Issabel; all writes target nora_ci.
            output=run(prefix+['--filter','@nora/api','exec','vitest','run','src/customer-affairs/call-center',
                              'src/integrations/issabel','src/hr/hr-call-answer-directory','src/iam/iam-call-request-assignees',
                              '--maxWorkers=1'],timeout=900)
            (WORK/'tests.log').write_text(output)
            report['test_summary']=[line.strip() for line in output.splitlines() if 'Test Files' in line or 'Tests ' in line][-3:]
            if snapshot()!=before: raise RuntimeError('Live deployment changed during build')
            report.update(complete=True,stage='candidate_validated',live_containers_preserved=True)
        except Exception as error:
            report.update(stage='failed',failure=str(error)[:300],failure_type=type(error).__name__)
            if (WORK/'failure.log').exists():
                tail=(WORK/'failure.log').read_text(errors='replace')[-5000:]
                if password: tail=tail.replace(password,'[REDACTED]')
                report['diagnostic_tail']=tail
        finally:
            subprocess.run(['docker','rm','-f',CHECK],capture_output=True)
            if pg_created: subprocess.run(['docker','rm','-f','-v',PG],capture_output=True)
            if network_created: subprocess.run(['docker','network','rm',NETWORK],capture_output=True)
            for name in ('postgres.env','test.env'):
                (WORK/name).unlink(missing_ok=True)
            report['live_containers_preserved']=snapshot()==before
            receipt(report)
        print('PASS: candidate built and tested; live ERP unchanged.' if report['complete'] else 'INCOMPLETE: inspect build receipt; live ERP not activated.')
        print('Receipt: '+str(REPORT))
        return 0 if report['complete'] else 1


if __name__=='__main__':
    raise SystemExit(main())
