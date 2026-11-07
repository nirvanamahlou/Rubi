import os, sys, json, pathlib, subprocess, hashlib, tarfile, shutil, time, fcntl, re
from pathlib import Path
"""Owner-authorized latest-develop release preserving live overlays and data.

Reuses the hash-pinned installed release definitions. Source archives are Git-only;
private encrypted backups remain server-local. Holds the shared deployment lock.
"""
os.umask(0o077)
# Reuse reviewed health, snapshot, source verification, canary and rollback logic.
prior = Path('/opt/rubi/avina-safe-develop-refresh-1102/deploy.py')
assert hashlib.sha256(prior.read_bytes()).hexdigest() == 'a8ad55b0f1ba8f19ec8f5d40b2f62efec59a63bf59a175e6fd3fcac2de1c8c0a'
definitions = prior.read_text().split('phase = sys.argv[1]')[0]
guard = "assert read('offserver-backup-verified')['hashes']==before['hashes']"
assert definitions.count(guard) == 2
definitions = definitions.replace(guard, "assert read('server-backup-verified')['hashes']==before['hashes']")
exec(compile(definitions, str(prior), 'exec'))
WORK = ROOT / 'server-develop-bd59eafd4-1107'
REVISION = 'bd59eafd4225c6b659553284a5ca22f8814bff44'
IMAGE = 'rubi-production:develop-bd59eafd4-1107'
ARCHIVES = {'source.tar.gz':'d964b9044a428a71a4754ac23ceae152e7125c57bd42408776e879b47d14b3ea', 'base.tar.gz':'2da2386255c78b096578936246fe8bd665d09430ea28f032d41804bc6a20c139'}
CONTEXT = WORK / 'context'
PENDING = ['20261102190000_airline_identifier_codes']

def checkpoint(name):
    assert healthy()
    state = snapshot(); compose_hash = filehash(COMPOSE)
    assert shutil.disk_usage(ROOT).free > 4 * 1024**3
    folder = ROOT / 'backups' / ('before-develop-bd59eafd4-' + name + '-' + str(int(time.time())))
    folder.mkdir(mode=0o700)
    encrypted(['docker','exec','rubi-production-postgres-1','pg_dump','-U','rubi','-d','rubi','-Fc'], folder/'database.dump.enc', ['docker','exec','-i','rubi-production-postgres-1','pg_restore','--list'])
    encrypted(['docker','exec','rubi-production-api-1','tar','-C','/srv/rubi/documents','-czf','-','.'], folder/'documents.tar.gz.enc', ['tar','-tzf','-'])
    encrypted(['tar','-C','/opt/rubi','-czf','-','compose.yaml','private'], folder/'configuration-public-documents.tar.gz.enc', ['tar','-tzf','-'])
    hashes = {p.name:filehash(p) for p in folder.glob('*.enc')}
    assert len(hashes)==3 and snapshot()==state and filehash(COMPOSE)==compose_hash
    receipt = {'folder':str(folder),'createdAt':time.time(),'state':state,'composeHash':compose_hash,'oldAssets':assets(),'hashes':hashes,'storage':'server-persistent','noOffserverCopy':True}
    (folder/'manifest.json').write_text(json.dumps(receipt,indent=2))
    for p in folder.iterdir():
        with p.open('rb') as f: os.fsync(f.fileno())
    fd=os.open(folder,os.O_RDONLY);os.fsync(fd);os.close(fd)
    save(name+'-backup-verified',receipt)
    print('SERVER_ENCRYPTED_BACKUP_VERIFIED '+str(folder),flush=True)
    return receipt

def archive_files(path):
    result={}
    with tarfile.open(path) as a:
        for m in a.getmembers():
            if m.isfile(): result[m.name]=digest(normalize(a.extractfile(m).read()))
    return result

def prepare_current():
    assert healthy()
    for name,want in ARCHIVES.items(): assert filehash(WORK/name)==want, 'Archive hash mismatch'
    with tarfile.open(WORK/'source.tar.gz') as a: expanded=sum(m.size for m in a.getmembers() if m.isfile())
    state=snapshot(); compose_hash=filehash(COMPOSE)
    ids=capture(['docker','ps','-aq']).split()
    containers=json.loads(capture(['docker','inspect',*ids])) if ids else []
    for temp in [CONTEXT,WORK/'public']:
        assert temp.resolve().parent==WORK.resolve()
        if temp.exists():
            assert not any(Path(m['Source']).resolve().is_relative_to(temp.resolve()) for c in containers for m in c['Mounts'])
            shutil.rmtree(temp)
    assert shutil.disk_usage(ROOT).free > expanded*2 + 3*1024**3, 'Insufficient preparation capacity'
    CONTEXT.mkdir(mode=0o700)
    release=CONTEXT/'release';extract(WORK/'source.tar.gz',release)
    bh=archive_files(WORK/'base.tar.gz');th=archive_files(WORK/'source.tar.gz');preserved={};shared={}
    js="""const fs=require('fs'),c=require('crypto'),out=[];function walk(p){if(!fs.existsSync(p))return;for(const d of fs.readdirSync(p,{withFileTypes:true})){const n=p+'/'+d.name;if(d.isDirectory()){if(!['node_modules','dist','.next','generated'].includes(d.name))walk(n)}else if(d.isFile()){let b=fs.readFileSync(n);try{new(require('util').TextDecoder)('utf8',{fatal:true}).decode(b);b=Buffer.from(b.toString().replace(/\\r\\n/g,'\\n'))}catch{}out.push([n.replace('/workspace/',''),c.createHash('sha256').update(b).digest('hex')])}}}process.argv.slice(1).forEach(walk);console.log(JSON.stringify(out));"""
    with tarfile.open(WORK/'base.tar.gz') as base_archive:
        for service in ['api','web','worker']:
            roots=['/workspace/apps/'+service+'/src','/workspace/packages/contracts/src']
            if service=='web':roots+=['/workspace/apps/web/scripts','/workspace/apps/web/public/package-generator']
            names=json.loads(capture(['docker','exec','rubi-production-'+service+'-1','node','-e',js,*roots]))
            for name,live_hash in names:
                if live_hash in [bh.get(name),th.get(name)]:continue
                current=normalize(run(['docker','exec','rubi-production-'+service+'-1','cat','/workspace/'+name],capture_output=True).stdout)
                ch=digest(current);b=bh.get(name);t=th.get(name)
                if ch in [b,t]:continue
                if name.startswith('packages/'):
                    if name in shared:assert shared[name]==ch,'Inconsistent shared live source';continue
                    shared[name]=ch
                dest=release/name
                if t is None:
                    assert b is None,'Deleted target has live modifications: '+name;effective=current
                elif b is None:
                    raise RuntimeError('New target overlaps live source: '+name)
                elif t==b:effective=current
                else:
                    base=normalize(base_archive.extractfile(name).read());desired=normalize(dest.read_bytes())
                    if name.endswith('.json') or name.endswith('/i18n-catalog.js'):
                        legacy=name.endswith('/i18n-catalog.js')
                        parse=lambda data:json.loads(data.decode().split('=',1)[1].strip().rstrip(';')) if legacy else json.loads(data)
                        old,new,live=map(parse,[base,desired,current]);value=dict(new)
                        for k in set(old)|set(live):
                            if live.get(k)==old.get(k):continue
                            assert new.get(k) in [old.get(k),live.get(k)],'JSON source conflict: '+name
                            if k in live:value[k]=live[k]
                            else:value.pop(k,None)
                        effective=(('window.RUBI_ENGLISH_UI = '+json.dumps(value,ensure_ascii=False)+';\n') if legacy else json.dumps(value,ensure_ascii=False,indent=2)+'\n').encode()
                    else:
                        merge=WORK/'merge';merge.mkdir(exist_ok=True)
                        for suffix,data in [('desired',desired),('base',base),('current',current)]:(merge/suffix).write_bytes(data)
                        p=subprocess.run(['git','merge-file','-p',str(merge/'desired'),str(merge/'base'),str(merge/'current')],capture_output=True)
                        if p.returncode:
                            (WORK/'conflict.txt').write_bytes(p.stdout)
                            raise RuntimeError('Source conflict requires review: '+name)
                        else:effective=p.stdout
                dest.parent.mkdir(parents=True,exist_ok=True);dest.write_bytes(effective);preserved[name]=digest(effective)
    save('preserved-source',preserved)
    public_source=next(Path(m['Source']) for m in state['web']['mounts'] if m['Destination']=='/workspace/apps/web/public')
    public_target=release/'apps/web/public'
    for p in public_source.rglob('*'):
        assert p.resolve().is_relative_to(public_source.resolve())
        if p.is_file():
            dest=public_target/p.relative_to(public_source)
            if not dest.exists():dest.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(p,dest)
    persistent=WORK/'public';persistent.mkdir(mode=0o700)
    for p in public_target.rglob('*'):
        if p.is_file():
            rel=p.relative_to(public_target);dest=persistent/rel;old=public_source/rel;dest.parent.mkdir(parents=True,exist_ok=True)
            if old.is_file() and filehash(old)==filehash(p):os.link(old,dest)
            else:shutil.copy2(p,dest)
    run(['docker','cp','rubi-production-web-1:/workspace/apps/web/.next/static',str(CONTEXT/'previous-static')],stdout=subprocess.DEVNULL)
    # Public assets are already present in the base image and in the preserved
    # public bind directory. Copy only changed files into the candidate layer.
    for path in list((release/'apps/web/public').rglob('*')):
        if path.is_file():
            name=str(path.relative_to(release))
            if bh.get(name)==th.get(name) and name not in preserved:
                path.unlink()
    applied=migrations();expected=sorted(p.name for p in (release/'packages/database/prisma/migrations').iterdir() if p.is_dir());pending=sorted(set(expected)-set(applied))
    assert pending==PENDING,'Unexpected pending migrations: '+str(pending)
    dockerfile='FROM '+state['api']['image']+'\nWORKDIR /workspace\n'
    dockerfile+='RUN rm -rf apps/api/src apps/web/src apps/worker/src packages/contracts/src packages/database/src packages/database/prisma apps/api/dist apps/worker/dist packages/contracts/dist packages/database/dist apps/web/.next\n'
    dockerfile+='COPY release/ ./\nCOPY previous-static/ /tmp/previous-static/\n'
    dockerfile+='RUN export DATABASE_URL=postgresql://unused:unused@127.0.0.1:5432/unused NODE_OPTIONS=--max-old-space-size=2048; pnpm db:generate && pnpm --filter @nora/contracts build && pnpm --filter @nora/database build && pnpm --filter @nora/api build && pnpm --filter @nora/worker build\n'
    dockerfile+='RUN NEXT_PUBLIC_CALL_CENTER_POPUPS_ENABLED=true NEXT_PUBLIC_CALL_CENTER_OUTBOUND_POPUPS_ENABLED=true NEXT_PUBLIC_API_BASE_URL=https://avinaofficial.ir/api/v1 NEXT_TELEMETRY_DISABLED=1 NODE_OPTIONS=--max-old-space-size=2048 pnpm --filter @nora/web build --webpack && cp -an /tmp/previous-static/. apps/web/.next/static/ && rm -rf /tmp/previous-static apps/web/.next/cache\n'
    dockerfile+='LABEL rubi.develop-revision="'+REVISION+'"\nLABEL rubi.source-revision="'+REVISION+'"\n'
    (CONTEXT/'Dockerfile').write_text(dockerfile)
    effective=dict(th);effective.update(preserved)
    save('prepared',{'revision':REVISION,'base':state,'composeHash':compose_hash,'migrations':applied,'pendingMigrations':pending,'preservedLiveFiles':preserved,'sourceHashes':effective,'image':IMAGE,'publicSource':str(public_source),'publicTarget':str(persistent)})
    assert snapshot()==state and filehash(COMPOSE)==compose_hash
    print('PREPARED preserved='+str(len(preserved))+' pending='+str(pending),flush=True)

def build_current():
    record=read('prepared');assert snapshot()==record['base'] and filehash(COMPOSE)==record['composeHash']
    with (WORK/'docker-build.log').open('w') as log:run(['docker','build','-t',IMAGE,str(CONTEXT)],stdout=log,stderr=subprocess.STDOUT)
    verify_sources(record)
    tests={'api':['src/package-pricing/package-tour-pricing.service.spec.ts','src/package-pricing/published-package-sale.spec.ts','src/finance/payments/payment-source.spec.ts','src/finance/finance-inbox-purchases.spec.ts','src/integrations/ghestiroo.spec.ts','src/hr/hr-call-answer-directory.spec.ts'], 'web':['src/modules/finance/model/receipt-account.spec.ts','src/modules/finance/components/finance-inbox-presentation.spec.tsx','src/modules/finance/components/component-contract.spec.ts','src/modules/pricing-management/model/package-generator-data.spec.ts','src/modules/pricing-management/components/source-package-generator.spec.ts','src/modules/call-center/live-popup-eligibility.spec.ts','src/modules/hr/hr-unified-employee.spec.tsx']}
    for app, added in {'api': ['src/customer-affairs/expert-performance.spec.ts', 'src/customer-affairs/workbench-removal.spec.ts', 'src/customer-affairs/workbench-request-assignment.spec.ts', 'src/documents/documents-daily-packages.service.spec.ts', 'src/documents/documents.repository.spec.ts', 'src/documents/documents.service.spec.ts', 'src/hr/hr-self-performance.spec.ts', 'src/iam/authenticated-permissions.spec.ts', 'src/marketing/marketing-records.service.spec.ts', 'src/messaging/messaging.service.spec.ts', 'src/procurement/procurement.registrations.pg.spec.ts', 'src/reporting/reporting-native-dashboard.spec.ts', 'src/sales/party-receipts.public.spec.ts', 'src/sales/sales-contract-only-flight.spec.ts', 'src/workbench/workbench-performance.spec.ts', 'src/finance/operations/party-receipts.spec.ts'], 'web': ['src/lib/navigation.spec.ts', 'src/modules/call-center/completion-status.spec.tsx', 'src/modules/call-center/kpi-call-actions.spec.tsx', 'src/modules/call-center/report-highlights.spec.tsx', 'src/modules/call-center/source-share-chart.spec.tsx', 'src/modules/correspondence/incoming-letter-workspace.spec.tsx', 'src/modules/correspondence/letter-export.spec.ts', 'src/modules/procurement/internal-sections.spec.tsx', 'src/modules/procurement/petty-registrations.spec.tsx', 'src/modules/reservation-purchases/model.spec.ts', 'src/modules/reservation-purchases/workspace.spec.tsx', 'src/modules/workbench/messaging-api.spec.ts', 'src/modules/finance/components/finance-inbox-presentation.spec.tsx', 'src/modules/finance/components/party-receipts.spec.tsx', 'src/modules/legal-entities/model/context.spec.ts', 'src/modules/marketing/components/component-contract.spec.ts', 'src/modules/marketing/components/content-list.spec.tsx', 'src/modules/marketing/model/marketing.spec.ts', 'src/modules/reservations/components/contract-amendment-model.spec.ts', 'src/modules/reservations/components/reservation-sales-amendment.spec.tsx', 'src/modules/reservations/components/travel-document.spec.tsx', 'src/modules/reservations/server/ghesati-branding.spec.ts', 'src/modules/reservations/server/reservation-pdf.spec.ts']}.items(): tests[app]=sorted(set(tests[app]+added))
    for app,paths in tests.items():
        with (WORK/('tests-'+app+'.log')).open('w') as log:run(['docker','run','--rm','--network','none','-e','NODE_ENV=test','--workdir','/workspace/apps/'+app,'--entrypoint','node',IMAGE,'node_modules/vitest/vitest.mjs','run','--maxWorkers=1',*paths],stdout=log,stderr=subprocess.STDOUT)
    ef=WORK/'canary.env';ef.write_text('\n'.join(inspect('web')['Config']['Env'])+'\n');canary='rubi-develop-bd59eafd4-canary'
    try:
        args=['docker','run','-d','--name',canary,'-p','127.0.0.1:3331:3000','--env-file',str(ef),'--entrypoint','node']
        for m in state_mounts(record):
            source=record['publicTarget'] if m['Destination']=='/workspace/apps/web/public' else m['Source']
            args+=['-v',source+':'+m['Destination']+('' if m['RW'] else ':ro')]
        run(args+[IMAGE,'apps/web/node_modules/next/dist/bin/next','start','apps/web','--hostname','0.0.0.0','--port','3000'],stdout=subprocess.DEVNULL)
        for _ in range(45):
            try:
                status,data=get('/login',3331)
                if status==200 and b'/_next/static/' in data:break
            except OSError:pass
            time.sleep(2)
        else:raise RuntimeError('Isolated canary failed')
    finally:
        subprocess.run(['docker','rm','-f',canary],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL);ef.unlink(missing_ok=True)
    save('build-verified',record)
    assert snapshot()==record['base'] and filehash(COMPOSE)==record['composeHash']
    # Reclaim only this task's generated, unmounted build context. The verified
    # image, exact source archive, public bind directory and backups are retained.
    assert CONTEXT.resolve().parent==WORK.resolve()
    ids=capture(['docker','ps','-aq']).split()
    containers=json.loads(capture(['docker','inspect',*ids])) if ids else []
    assert not any(Path(m['Source']).resolve().is_relative_to(CONTEXT.resolve()) for c in containers for m in c['Mounts'])
    shutil.rmtree(CONTEXT)
    assert (WORK/'base.tar.gz').resolve().parent==WORK.resolve()
    (WORK/'base.tar.gz').unlink()
    (WORK/'source.tar.gz').unlink()
    print('BUILD_SOURCE_TESTS_VERIFIED',flush=True)

def state_mounts(record):
    return record['base']['web']['mounts']

def deploy_current():
    record=read('build-verified');assert snapshot()==record['base'] and filehash(COMPOSE)==record['composeHash']
    before=read('initial-backup-verified')
    if time.time()-before['createdAt']>720: before=checkpoint('activation')
    assert time.time()-before['createdAt']<900 and before['state']==record['base'] and all(filehash(Path(before['folder'])/n)==h for n,h in before['hashes'].items())
    save('backup-verified',before);save('server-backup-verified',before)
    cmd=['docker','compose','-p','rubi-production','-f',str(COMPOSE)]
    ef=WORK/'migration.env'
    query='SELECT COALESCE(jsonb_object_agg(id::text,md5((to_jsonb(t)||jsonb_build_object(\'code\',rtrim(code)))::text)),\'{}\'::jsonb) FROM master_airlines t'
    try:
        run(cmd+['stop','api','worker'],stdout=subprocess.DEVNULL)
        original=capture(['docker','exec','rubi-production-postgres-1','psql','-X','-U','rubi','-d','rubi','-qAtc',query])
        network=list(inspect('api')['NetworkSettings']['Networks']);assert len(network)==1
        pg=dict(v.split('=',1) for v in inspect('postgres')['Config']['Env'] if '=' in v)
        url='postgresql://'+quote(pg['POSTGRES_USER'],safe='')+':'+quote(pg['POSTGRES_PASSWORD'],safe='')+'@postgres:5432/'+quote(pg['POSTGRES_DB'],safe='')+'?schema=public'
        ef.write_text('DATABASE_URL='+url+'\n')
        with (WORK/'migration.log').open('w') as log:run(['docker','run','--rm','--network',network[0],'--env-file',str(ef),'--entrypoint','pnpm',IMAGE,'--filter','@nora/database','exec','prisma','migrate','deploy'],stdout=log,stderr=subprocess.STDOUT)
        assert migrations()==sorted(record['migrations']+PENDING)
        after=capture(['docker','exec','rubi-production-postgres-1','psql','-X','-U','rubi','-d','rubi','-qAtc',query]);assert original==after,'Airline facts changed'
        save('migration-proof',{'applied':PENDING,'airlineRowsPreserved':True})
    finally:
        ef.unlink(missing_ok=True);run(cmd+['start','api','worker'],stdout=subprocess.DEVNULL)
    for _ in range(60):
        if healthy():break
        time.sleep(2)
    else:raise RuntimeError('Existing runtime not healthy after migration')
    assert snapshot()==record['base']
    activate()


ARCHIVES = {
    'source.tar.gz': '3308e9ef18b0035400a51fc9c5ac85e7b567aea56f1d997cf0f52240276e2d91',
    'base.tar.gz': '8f564106a4eda97bb565ed81cd1c9c63d89c6a64cd9884168a31c35d923539be',
}
PENDING = ['20261107090000_package_rial_conversion', '20261107120000_manifest_document_references']
_integration_ready = integration_ready

def integration_ready():
    api, worker = inspect('api'), inspect('worker')
    assert worker['HostConfig']['NetworkMode'] == 'container:' + api['Id'], 'Worker namespace mismatch'
    _integration_ready()

def run(args, **kwargs):
    args = list(args)
    if args[:2] == ['docker', 'build']:
        args[2:2] = ['--network', 'none']
    if 'node_modules/vitest/vitest.mjs' in args:
        args[3:3] = ['-e', 'NODE_OPTIONS=--max-old-space-size=2048']
        app = args[args.index('--workdir') + 1].rsplit('/', 1)[-1]
        extra = {
            'web': ['src/modules/reservations/model', 'src/modules/reservations/server',
                    'src/modules/reservations/components', 'src/components/layout/change-notifications.spec.ts',
                    'src/modules/hr/hr-user-options.spec.tsx'],
            'api': ['src/reservations/voucher-settings.spec.ts', 'src/reservations/hotel-supplier-forms.spec.ts',
                    'src/iam/iam-attendance-connector.spec.ts', 'src/hr/hr-user-unit-directory.spec.ts'],
        }
        # Only append existing synthetic test paths present in this candidate.
        for path in extra.get(app, []):
            if path not in args:
                args.append(path)
    kwargs.setdefault('timeout', 900)
    return subprocess.run(args, check=True, **kwargs)

phase = sys.argv[1]
with (ROOT/'avina-deploy.lock').open('a') as lock:
    fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
    assert read('ci-approved')['revision'] == REVISION and read('ci-approved')['conclusion'] == 'success'
    PENDING = sorted(set(PENDING) - set(migrations()))
    save(phase+'-status', {'status': 'running', 'startedAt': time.time()})
    try:
        if phase == 'prepare':
            prepare_current()
        elif phase == 'build':
            build_current()
        elif phase == 'deploy':
            assert snapshot() == read('build-verified')['base']
            assert filehash(COMPOSE) == read('build-verified')['composeHash']
            assert shutil.disk_usage(ROOT).free > 4 * 1024**3, 'Backup and rollback capacity required'
            checkpoint('initial')
            assert shutil.disk_usage(ROOT).free > 2 * 1024**3, 'Maintain operational disk reserve'
            deploy_current()
            with (ROOT/'DEPLOYMENT-RECORD.txt').open('a') as output:
                output.write('\nSERVER-DEVELOP-REFRESH-1107 '+json.dumps(read('verified'))+'\n')
        else:
            raise RuntimeError('Unknown release phase')
        save(phase+'-status', {'status': 'success', 'finishedAt': time.time()})
    except BaseException as error:
        save(phase+'-status', {'status': 'failed', 'errorType': type(error).__name__})
        raise
