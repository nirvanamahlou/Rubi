#!/usr/bin/env python3
"""Bounded API-only activation of validated real Issabel ingress.

Existing HR links only. IAM and Integration writes use their owning public services.
No PBX command, synthetic call, UI change, or destructive schema rollback.
"""
import datetime
import fcntl
import hashlib
import json
import os
from pathlib import Path
import re
import subprocess
import time
import urllib.parse
import urllib.request
import uuid

ROOT=Path('/opt/rubi')
WORK=ROOT/'private/call-center-live-ingress-release4-1031'
REPORT=ROOT/'CALL-CENTER-LIVE-INGRESS-RELEASE4-1031.json'
BASE='rubi-production:358bf900f691016c00ed5b5a9c346cdd7aedea34'
IMAGE='rubi-production:call-center-answered-1031-358'
IMAGE_ID='sha256:373261230ff4fac1a82bc2d87fbcb432fb7b722aefce11ecfbd132e21f9d5169'
BOOTSTRAP=Path('/home/rubi-deploy/live-ingress-bootstrap.mjs')
BOOTSTRAP_SHA='bbe036a455682e705c2ec363250cd3774bf08db43439c1cb17e05493304beaab'
OBSERVER=Path('/home/rubi-deploy/observe-live-ingress.py')
OBSERVER_SHA='3f87a9c0aedd104ae6c367935bd3f5ec7c8dc95f2f725c9bff2a23fb681e1430'
TOPOLOGY=Path('/home/rubi-deploy/.call-center-topology-1029.json')
MIGRATION='20261029120000_call_answer_responsibilities'
TEMP_CONTAINER='rubi-call-center-live-admin-1029'


def run(args,timeout=45,input=None):
    p=subprocess.run(args,capture_output=True,timeout=timeout,input=input)
    if p.returncode:
        if WORK.exists(): (WORK/'failure.log').write_bytes(p.stdout+p.stderr)
        raise RuntimeError('Operation failed: '+' '.join(args[:3])+' exit='+str(p.returncode))
    return p.stdout.decode(errors='replace')


def inspect(service):
    return json.loads(run(['docker','inspect','rubi-production-'+service+'-1']))[0]


def env(item):
    return dict(value.split('=',1) for value in item['Config']['Env'])


def sql(query):
    output=run(['docker','exec','rubi-production-postgres-1','psql','-X','-U','rubi','-d','rubi',
                '-v','ON_ERROR_STOP=1','-qAtc',"BEGIN READ ONLY; SET LOCAL statement_timeout='8000ms'; "+query+' COMMIT;'])
    return json.loads(output)


def health():
    try:
        with urllib.request.urlopen('https://avinaofficial.ir/api/v1/health',timeout=10) as response:
            return response.status==200 and json.load(response)['data']['status']=='ok'
    except Exception: return False


def write(path,data,mode=0o600):
    fd=os.open(path,os.O_WRONLY|os.O_CREAT|os.O_EXCL|os.O_NOFOLLOW,mode)
    with os.fdopen(fd,'w') as stream: stream.write(data)


def save(report):
    temp=ROOT/'.call-center-live-ingress-1029.tmp'
    write(temp,json.dumps(report,indent=2),0o644);os.chmod(temp,0o644);os.replace(temp,REPORT)


def replace_compose(data,mode):
    target=ROOT/'compose.yaml';temp=ROOT/'.compose-call-center-1029.tmp'
    write(temp,data,mode);os.chmod(temp,mode);os.replace(temp,target)


def proposal(original,path):
    lines=original.splitlines(keepends=True)
    starts=[i for i,line in enumerate(lines) if line.rstrip()=='  api:']
    if len(starts)!=1: raise RuntimeError('Unsupported API service layout')
    start=starts[0];end=next((i for i in range(start+1,len(lines)) if re.match(r'^  [a-zA-Z0-9_-]+:',lines[i])),len(lines))
    image=[i for i in range(start+1,end) if lines[i].strip()=='image: '+BASE]
    if len(image)!=1: raise RuntimeError('Unexpected API base image')
    lines[image[0]]=lines[image[0]].replace(BASE,IMAGE)
    entries=[i for i in range(start+1,end) if re.match(r'^    env_file:',lines[i])]
    if len(entries)!=1 or lines[entries[0]].split(':',1)[1].strip():
        raise RuntimeError('Expected existing env_file list; inspect before activation')
    index=entries[0]
    stop=next((i for i in range(index+1,end) if re.match(r'^    [a-zA-Z0-9_-]+:',lines[i])),end)
    indent=next((re.match(r'^(\s*)-',line).group(1) for line in lines[index+1:stop] if re.match(r'^\s*-',line)),None)
    if indent is None: raise RuntimeError('Existing API environment files not found')
    lines.insert(stop,indent+'- '+str(path)+'\n')
    return ''.join(lines)


def dotenv(values):
    result=[]
    for key,value in values.items():
        if not re.fullmatch('[A-Z_][A-Z0-9_]*',key) or '\0' in value or '\r' in value:
            raise RuntimeError('Invalid private environment value')
        quoted=json.dumps(value) if '\n' in value else "'"+value.replace("'","\\'")+"'"
        result.append(key+'='+quoted)
    return '\n'.join(result)+'\n'


def compose_model(output):
    # Compose2.40 config.go runConfig escapes every dollar for re-serialization,
    # including JSON. Undo exactly that output layer, not env-file interpolation.
    return json.loads(output.replace('$$','$'))


def migration_database_url(application_url, postgres_environment):
    """Use the existing DB administrator only in the one-off migration container."""
    url=urllib.parse.urlsplit(application_url)
    if (url.scheme not in ('postgresql','postgres') or url.hostname!='postgres' or
        url.port not in (None,5432) or url.path!='/rubi' or url.username!='rubi_app' or
        postgres_environment.get('POSTGRES_USER')!='rubi' or
        postgres_environment.get('POSTGRES_DB')!='rubi' or
        not postgres_environment.get('POSTGRES_PASSWORD')):
        raise RuntimeError('Unexpected database identity; inspect before migration')
    password=urllib.parse.quote(postgres_environment['POSTGRES_PASSWORD'],safe='')
    # Do not inherit runtime read-only/options/role parameters into administrative DDL.
    return urllib.parse.urlunsplit(('postgresql','rubi:'+password+'@postgres:5432','/rubi','',''))


def main():
    if os.geteuid()!=0: raise SystemExit('Run as root')
    os.umask(0o077)
    if WORK.exists() or REPORT.exists(): raise SystemExit('Existing activation requires inspection')
    build=json.loads((ROOT/'CALL-CENTER-LIVE-BUILD-1031.json').read_text())
    if not build.get('complete') or build.get('candidate_image_id')!=IMAGE_ID or not build.get('source_verified'):
        raise SystemExit('Validated candidate receipt required')
    if hashlib.sha256(BOOTSTRAP.read_bytes()).hexdigest()!=BOOTSTRAP_SHA:
        raise SystemExit('Bootstrap source changed')
    observer_source=OBSERVER.read_bytes()
    if hashlib.sha256(observer_source).hexdigest()!=OBSERVER_SHA:
        raise SystemExit('Read-only acceptance observer changed')
    image=json.loads(run(['docker','image','inspect',IMAGE]))[0]
    if image['Id']!=IMAGE_ID: raise SystemExit('Candidate image changed')
    topology=json.loads(TOPOLOGY.read_text())
    if (not topology.get('extensions') or any(not re.fullmatch(r'\d{2,10}',s) for s in topology['extensions']) or
        not topology.get('trunks') or any(not re.fullmatch(r'(?:SIP|PJSIP)/[a-zA-Z0-9_.-]{1,64}',s) for s in topology['trunks'])):
        raise SystemExit('Verified provider topology required')
    baseline={name:inspect(name) for name in ('api','worker','web','postgres','redis')}
    if any(not item['State']['Running'] for item in baseline.values()) or any(baseline[n]['Config']['Image']!=BASE for n in ('api','worker','web')):
        raise SystemExit('Live release changed')
    original=(ROOT/'compose.yaml').read_text();original_mode=(ROOT/'compose.yaml').stat().st_mode & 0o777
    if not health(): raise SystemExit('Current ERP health failed')
    run(['/usr/local/sbin/rubi-backup-create-1027'],timeout=600)
    with open(ROOT/'avina-deploy.lock','r') as lock:
        fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        if (ROOT/'compose.yaml').read_text()!=original or any(inspect(n)['Id']!=v['Id'] for n,v in baseline.items()):
            raise SystemExit('Concurrent deployment detected')
        if env(baseline['api']).get('ISSABEL_ENABLED')=='true': raise SystemExit('Collector already enabled')
        if subprocess.run(['docker','container','inspect',TEMP_CONTAINER],capture_output=True).returncode==0:
            raise SystemExit('Existing administrative container requires inspection')
        WORK.mkdir(mode=0o700)
        write(WORK/'compose.before.yaml',original)
        write(WORK/'bootstrap.mjs',BOOTSTRAP.read_text())
        write(WORK/'observe.py',observer_source.decode())
        network=list(baseline['api']['NetworkSettings']['Networks'])
        if len(network)!=1: raise SystemExit('Ambiguous production network')
        network=network[0]
        report={'complete':False,'stage':'preflight','base':BASE,'candidate':IMAGE,'database_migration_retained':False,
                'web_and_worker_unchanged':True,'time_utc':datetime.datetime.now(datetime.timezone.utc).isoformat()}
        original_env=env(baseline['api']);progress=None;plan=None;changed=False
        command=['docker','compose','-f',str(ROOT/'compose.yaml')]

        def bootstrap(phase,environment,previous=None):
            request={**plan,'phase':phase,'environment':environment}
            if previous: request['previous']=previous
            p=subprocess.run(['docker','run','--rm','--name',TEMP_CONTAINER,'-i','--network',network,
                 '--mount','type=bind,source='+str(WORK/'bootstrap.mjs')+',target=/bootstrap.mjs,readonly',
                 '--entrypoint','node',IMAGE_ID,'/bootstrap.mjs'],input=json.dumps(request).encode(),capture_output=True,timeout=180)
            value=json.loads(p.stdout) if p.stdout else {}
            write(WORK/(phase+'-result.json'),json.dumps(value,indent=2))
            if p.returncode:
                (WORK/(phase+'-error.log')).write_bytes(p.stderr)
                error=RuntimeError('Administrative '+phase+' failed; inspect private receipt')
                error.progress=value
                raise error
            return value

        try:
            # Reuse the reviewed read-only identity SQL, pinned alongside this runner.
            preflight=Path('/home/rubi-deploy/inspect-call-center-1029.py')
            if hashlib.sha256(preflight.read_bytes()).hexdigest()!='725d4685c176eb83b4d34240f4b5ecc02c44512ad4d7d5a03fc182ecd227b4b4':
                raise RuntimeError('Read-only identity query changed')
            scope={'__name__':'inspected_preflight'};exec(compile(preflight.read_bytes(),str(preflight),'exec'),scope)
            identity=sql(scope['IDENTITY_SQL'])
            branches=[b for b in identity['branches'] if b['code']=='HQ' and b['isActive']]
            prior=json.loads((ROOT/'private/call-center-live-ingress-retry2-1031/apply-result.json').read_text())
            connections=identity['connections'] or []
            if len(branches)!=1 or len(connections)!=1 or connections[0]['id']!=prior['connectionId'] or connections[0]['active'] or connections[0]['synthetic']:
                raise RuntimeError('Prior connection changed or ambiguous HR branch')
            branch=branches[0]['id'];accounts={u['id']:u for u in identity['accounts']}
            staff=[]
            for row in identity['extensions'] or []:
                user=accounts.get(row['user_id'])
                if not user or user['status']!='ACTIVE' or row['status']!='فعال': continue
                if row['branch_id']!=branch or branch not in (user['branches'] or []): raise RuntimeError('HR/account branch mismatch')
                if row['extension'] not in topology['extensions']: raise RuntimeError('HR extension is not a configured PBX endpoint')
                staff.append({'userId':user['id'],'extension':row['extension']})
            globals=[u['id'] for u in identity['accounts'] if u['username'] in ('danial','demo') and u['status']=='ACTIVE']
            if len(globals)!=2 or len(staff)!=13: raise RuntimeError('Inspected account roster changed')
            plan={'phase':'preview','branchId':branch,'connectionId':str(uuid.uuid4()),'staff':staff}
            plan['existingConnectionId']=prior['connectionId']
            report['unlinked_hr_extensions']=sorted({r['extension'] for r in identity['extensions'] or [] if not r['user_id']})
            report['configured_pbx_extensions']=len(topology['extensions'])
            ami=json.loads((ROOT/'private/call-center-vpn-retry3-1029/ami-client.json').read_text())
            settings={**ami,'ISSABEL_ENABLED':'false','ISSABEL_CONNECTION_ID':plan['connectionId'],
                'ISSABEL_EVENT_MODE':'NATIVE_QUEUE_CAPTURE','ISSABEL_CAPTURE_SCOPE':'COMPANY',
                'ISSABEL_COMPANY_EXTENSIONS':','.join(topology['extensions']),
                'ISSABEL_INBOUND_PEERS':','.join(topology['trunks']),'ISSABEL_OUTBOUND_PEERS':','.join(topology['trunks']),
                'ISSABEL_CHANNEL_TECHNOLOGY':'SIP','ISSABEL_USER_NOTIFICATIONS_ENABLED':'false',
                'ISSABEL_RECORDING_RETENTION_DAYS':'90','ISSABEL_RECOVERY_ENABLED':'false',
                'TELEPHONY_RELAY_ENABLED':'false','TELEPHONY_SYNTHETIC_ENABLED':'false',
                'CALL_CENTER_ACCESS_POLICY':'ANSWERED','CALL_CENTER_GLOBAL_USER_IDS':','.join(globals)}
            bootstrap_env={**original_env,**settings}
            readonly=dict(bootstrap_env);url=urllib.parse.urlsplit(readonly['DATABASE_URL'])
            query=urllib.parse.parse_qsl(url.query,keep_blank_values=True)
            query=[(k,v) for k,v in query if k!='options']+[('options','-c default_transaction_read_only=on')]
            readonly['DATABASE_URL']=urllib.parse.urlunsplit(url._replace(query=urllib.parse.urlencode(query)))
            report['stage']='readonly_permission_preview';save(report)
            preview=bootstrap('preview',readonly)
            report['staff_accounts']=preview['staff'];report['access_accounts']=preview['accessAccounts']
            # Candidate has exactly one new additive migration; apply no unrelated history.
            code="const fs=require('fs'),c=require('crypto'),p='/workspace/packages/database/prisma/migrations/'; console.log(JSON.stringify(Object.fromEntries(fs.readdirSync(p).filter(n=>fs.existsSync(p+n+'/migration.sql')).map(n=>[n,c.createHash('sha256').update(fs.readFileSync(p+n+'/migration.sql')).digest('hex')]))));"
            migrations=json.loads(run(['docker','run','--rm','--network','none','--entrypoint','node',IMAGE_ID,'-e',code]))
            applied=sql('SELECT coalesce(json_object_agg(migration_name,checksum),\'{}\'::json) FROM _prisma_migrations WHERE finished_at IS NOT NULL AND rolled_back_at IS NULL;')
            if set(migrations)-set(applied) not in (set(),{MIGRATION}) or not set(applied)<=set(migrations) or any(applied[n]!=migrations[n] for n in applied):
                raise RuntimeError('Migration history mismatch')
            if sql('SELECT count(*) FROM _prisma_migrations WHERE finished_at IS NULL AND rolled_back_at IS NULL;')!=0:
                raise RuntimeError('Unresolved migration')
            report['stage']='additive_migration';save(report)
            if '\n' in original_env['DATABASE_URL']: raise RuntimeError('Unsupported database URL shape')
            migration_url=migration_database_url(original_env['DATABASE_URL'],env(baseline['postgres']))
            migration_env=WORK/'migration.env';write(migration_env,'DATABASE_URL='+migration_url+'\n')
            run(['docker','run','--rm','--name',TEMP_CONTAINER,'--network',network,'--env-file',str(migration_env),
                 '--entrypoint','pnpm',IMAGE_ID,'--filter','@nora/database','exec','prisma','migrate','deploy'],timeout=300)
            migration_env.unlink();report['database_migration_retained']=True
            # New table is owned by the migration role. Keep runtime least-privilege:
            # grant CRUD on this exact additive table, never migration/schema authority.
            run(['docker','exec','rubi-production-postgres-1','psql','-X','-U','rubi','-d','rubi',
                 '-v','ON_ERROR_STOP=1','-qAtc',
                 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.call_center_answer_responsibilities TO rubi_app;'])
            report['migration_role_separated']=True
            report['stage']='configure_owned_services';save(report)
            progress=bootstrap('apply',bootstrap_env)
            settings['ISSABEL_CONNECTION_ID']=progress['connectionId'];settings['ISSABEL_ENABLED']='true'
            environment_file=WORK/'issabel.env';write(environment_file,dotenv(settings))
            proposed=proposal(original,environment_file)
            report['stage']='api_activation';save(report)
            replace_compose(proposed,original_mode);changed=True
            resolved=compose_model(run(command+['config','--format','json']))
            for key,value in settings.items():
                if resolved['services']['api']['environment'].get(key)!=value: raise RuntimeError('Private environment parsing mismatch')
            run(command+['up','-d','--no-deps','--force-recreate','api','worker'],timeout=180)
            probe="fetch(process.env.TELEPHONY_API_URL+'/internal/telephony-worker/pending',{headers:{authorization:'Bearer '+process.env.TELEPHONY_WORKER_SECRET},signal:AbortSignal.timeout(10000)}).then(async r=>{if(!r.ok||!Array.isArray(await r.json()))process.exitCode=1}).catch(()=>process.exitCode=1)"
            connection=uuid.UUID(progress['connectionId'])
            for _ in range(40):
                try:
                    if health():
                        run(['docker','exec','rubi-production-worker-1','node','-e',probe],timeout=15)
                        connected=sql("SELECT count(*) FROM integration_telephony_audit WHERE \"connectionId\"='"+str(connection)+"'::uuid AND action='AMI_CONNECTED';")
                        if connected>0: break
                except Exception: pass
                time.sleep(2)
            else: raise RuntimeError('Collector/Worker readiness verification failed')
            worker=inspect('worker')
            if env(worker)!=env(baseline['worker']) or any(worker['Config'].get(k)!=baseline['worker']['Config'].get(k) for k in ('Image','Cmd','Entrypoint','User','WorkingDir','ExposedPorts')) or worker['Mounts']!=baseline['worker']['Mounts']:
                raise RuntimeError('Unrelated Worker configuration changed')
            now=inspect('api')
            if now['Image']!=IMAGE_ID or sorted(now['Mounts'],key=lambda m:m['Destination'])!=sorted(baseline['api']['Mounts'],key=lambda m:m['Destination']) or now['HostConfig']['RestartPolicy']!=baseline['api']['HostConfig']['RestartPolicy']:
                raise RuntimeError('Unexpected API image/mount/restart state')
            now_env=env(now)
            if any(now_env.get(k)!=v for k,v in settings.items()) or {k:v for k,v in now_env.items() if k not in settings}!={k:v for k,v in original_env.items() if k not in settings}:
                raise RuntimeError('Unrelated environment changed')
            if any(inspect(n)['Id']!=baseline[n]['Id'] for n in ('web','postgres','redis')):
                raise RuntimeError('Unrelated service changed')
            report.update(worker_restarted_with_api_network=True,web_and_worker_unchanged=False,complete=True,stage='live_ingress_enabled',collector_authenticated=True,
                authenticated_worker_api=True,mappings=progress['mappings'],access_updates=progress['accessUpdates'],
                recording_retention_days=90,ui_unchanged=True,synthetic_enabled=False,
                real_call_acceptance='PENDING',recording_transfer_enabled=False,recovery_enabled=False)
            observer=subprocess.run(['systemd-run','--quiet','--collect','--unit=rubi-call-center-live-proof-1029',
                '--property=RuntimeMaxSec=1250','/usr/bin/python3',str(WORK/'observe.py'),str(connection)],capture_output=True)
            report['proof_monitor_started']=observer.returncode==0
            with (ROOT/'DEPLOYMENT-RECORD.txt').open('a') as record:
                record.write('\nCall Center ingress1029: API-only '+IMAGE+'; validated overlay base358bf900 + policy0dad51a92; Worker/Web preserved. Receipt '+str(REPORT)+'\n')
        except Exception as error:
            progress=getattr(error,'progress',None) or progress
            report.update(complete=False,failed_stage=report['stage'],failure_type=type(error).__name__,failure=str(error)[:250])
            failure_log=WORK/'apply-error.log' if (WORK/'apply-error.log').exists() else WORK/'failure.log'
            if failure_log.exists():
                diagnostic=failure_log.read_text(errors='replace')
                secret_values=list(original_env.values())+list(env(baseline['postgres']).values())
                for value in sorted(set(secret_values),key=len,reverse=True):
                    if len(value)>=6: diagnostic=diagnostic.replace(value,'[REDACTED]')
                diagnostic=re.sub(r'(?i)(?:postgres(?:ql)?|https?)://[^\s\x22\x27]+','[REDACTED_URL]',diagnostic)
                report['diagnostic_tail']=diagnostic[-5000:]
            if changed:
                replace_compose(original,original_mode)
                run(command+['up','-d','--no-deps','--force-recreate','api','worker'],timeout=180)
            if progress and plan:
                try: report['rollback']=bootstrap('rollback',bootstrap_env,previous=progress)
                except Exception: report['rollback_requires_review']=True
            report['stage']='activation_stopped'
            report['erp_health']=health()
        finally:
            subprocess.run(['docker','rm','-f',TEMP_CONTAINER],capture_output=True)
            (WORK/'migration.env').unlink(missing_ok=True)
            save(report)
        print('PASS: real Issabel ingress enabled; collector and Worker authenticated.' if report['complete'] else 'INCOMPLETE: activation stopped; inspect receipt.')
        print('Receipt: '+str(REPORT))
        return 0 if report['complete'] else 1


if __name__=='__main__': raise SystemExit(main())
